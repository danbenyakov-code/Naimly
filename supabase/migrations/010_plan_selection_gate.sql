-- ההתנסות מתחילה בבחירת מסלול, לא בהרשמה ולא בפרסום.
--
-- הבעיה שהתגלתה בבדיקה: משתמש שנרשם ישירות ב-/signup, בלי לעבור דרך
-- עמוד התמחור, נחת בדשבורד בלי מסלול כלל. הטיימר הראה 0, הבאנר אמר
-- "ההתנסות עוד לא התחילה", וללקוח לא היה שום מושג מה הוא קנה.
--
-- המודל החדש: אין גישה לדשבורד בלי בחירה מפורשת. plan_selected_at הוא
-- מקור האמת היחיד לשאלה "האם הלקוח בחר", והוא נקבע בשרת בלבד.

alter table public.subscriptions add column if not exists plan_selected_at timestamptz;

comment on column public.subscriptions.plan_selected_at is
  'מתי הלקוח בחר מסלול במפורש. null = טרם בחר, ולכן חסום בשער ההצטרפות.';

create index if not exists subscriptions_plan_selected_idx
  on public.subscriptions(plan_selected_at) where plan_selected_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. משתמש חדש — בלי מסלול, בלי ספירה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  -- current_period_end רחוק כדי שלא ייווצר מצב ביניים מוזר, אבל
  -- plan_selected_at ריק — וזה מה שחוסם בפועל בכל שלוש השכבות.
  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, trial_pending, plan_selected_at)
  values (new.id, 'trial', 'trialing', 'trial', now() + interval '365 days', true, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. בחירת התנסות — הרגע שבו השעון מתחיל
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.select_trial_plan()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ends_at timestamptz;
  already timestamptz;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED:יש להתחבר כדי לבחור מסלול.' using errcode = 'insufficient_privilege';
  end if;

  select s.plan_selected_at into already from public.subscriptions s where s.user_id = uid;

  -- בחירה חוזרת אינה מאפסת את ההתנסות. בלי התנאי הזה אפשר היה לחדש
  -- 14 יום בלי הגבלה פשוט בקריאה חוזרת לפונקציה.
  if already is not null then
    select s.trial_ends_at into ends_at from public.subscriptions s where s.user_id = uid;
    return ends_at;
  end if;

  ends_at := now() + interval '14 days';

  update public.subscriptions
  set plan_id = 'trial',
      status = 'trialing',
      provider = 'trial',
      trial_pending = false,
      plan_selected_at = now(),
      trial_started_at = now(),
      trial_ends_at = ends_at,
      current_period_end = ends_at,
      updated_at = now()
  where user_id = uid;

  update public.profiles set plan_id = 'trial', updated_at = now() where id = uid;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (uid, 'trial.start', 'user', uid::text,
          jsonb_build_object('trigger', 'plan_selection', 'ends_at', ends_at));

  return ends_at;
end;
$$;

revoke execute on function public.select_trial_plan() from public, anon;
grant execute on function public.select_trial_plan() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. בחירת מסלול בתשלום — מסמנת בחירה בלי לפתוח גישה
-- ─────────────────────────────────────────────────────────────────────────────
-- נקראת עם service-role בעת יצירת בקשת תשלום. הלקוח עובר את השער
-- ורואה את הדשבורד, אבל effective_plan עדיין 'none' עד לאישור המנהל,
-- ולכן העריכה חסומה וההודעה מסבירה שהתשלום ממתין.
create or replace function public.mark_plan_selected(target_user uuid, target_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set plan_selected_at = coalesce(plan_selected_at, now()),
      trial_pending = false,
      updated_at = now()
  where user_id = target_user;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (target_user, 'plan.select', 'user', target_user::text,
          jsonb_build_object('plan', target_plan));
end;
$$;

revoke execute on function public.mark_plan_selected(uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. בלי בחירה — אין מסלול ואין מנוי חי
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.effective_plan(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.plan_selected_at is null then 'none'
      when s.status = 'active' then s.plan_id
      when s.status = 'trialing' and s.current_period_end > now() then 'trial'
      else 'none'
    end
    from public.subscriptions s
    where s.user_id = target_user
  ), 'none');
$$;

create or replace function public.subscription_live(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.plan_selected_at is null then false
      when s.status = 'active' then true
      when s.status = 'trialing' and s.current_period_end > now() then true
      else false
    end
    from public.subscriptions s where s.user_id = target_user
  ), false);
$$;

grant execute on function public.subscription_live(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. הטריגר שהתחיל התנסות בפרסום — מיותר, והיה מאריך התנסות שכבר רצה
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists cards_start_trial_on_publish on public.cards;
drop function if exists public.start_trial_on_publish();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. רשומות קיימות — לא לנעול אף אחד בחוץ
-- ─────────────────────────────────────────────────────────────────────────────
-- כל מי שכבר משלם, כבר פרסם, או שכבר רצה לו ספירה — נחשב כמי שבחר.
update public.subscriptions
set plan_selected_at = coalesce(
      plan_selected_at,
      trial_started_at,
      case when status = 'active' then created_at end,
      case when trial_ends_at is not null then created_at end
    )
where plan_selected_at is null
  and (status = 'active' or trial_started_at is not null or trial_ends_at is not null);

update public.subscriptions s
set plan_selected_at = coalesce(s.plan_selected_at, s.created_at),
    trial_pending = false
where s.plan_selected_at is null
  and exists (select 1 from public.cards c where c.user_id = s.user_id and c.is_published = true);

-- מי שנשאר עם plan_selected_at ריק נרשם ולא בחר — הוא יעבור בשער.
