-- ההתנסות מתחילה בפרסום הראשון של הכרטיס, לא בהרשמה.
--
-- הרציונל: לקוח שנרשם ולא הספיק לבנות כרטיס לא "שורף" ימי התנסות.
-- שעון התפוגה נקבע כאן בשרת ולא בדפדפן.

alter table public.subscriptions add column if not exists trial_pending boolean not null default false;

comment on column public.subscriptions.trial_pending is
  'true = נרשם אך טרם פרסם, ולכן הספירה לא התחילה. trial_ends_at עדיין ריק.';

-- ── משתמש חדש: התנסות ממתינה, בלי תאריך תפוגה ─────────────────────────────
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

  -- ההתנסות מסומנת כממתינה. current_period_end נשאר רחוק כדי שהעריכה
  -- תהיה פתוחה עד לפרסום הראשון, שממנו מתחילה הספירה בפועל.
  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, trial_pending)
  values (new.id, 'trial', 'trialing', 'trial', now() + interval '365 days', true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── פרסום ראשון: התחלת הספירה ─────────────────────────────────────────────
create or replace function public.start_trial_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending boolean;
begin
  -- רק במעבר מ"לא מפורסם" ל"מפורסם".
  if new.is_published is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_published is true then
    return new;
  end if;

  select s.trial_pending into pending
  from public.subscriptions s
  where s.user_id = new.user_id and s.status = 'trialing';

  if pending is true then
    update public.subscriptions
    set trial_pending = false,
        trial_started_at = now(),
        trial_ends_at = now() + interval '14 days',
        current_period_end = now() + interval '14 days',
        updated_at = now()
    where user_id = new.user_id and status = 'trialing';

    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    values (new.user_id, 'trial.start', 'user', new.user_id::text,
            jsonb_build_object('trigger', 'first_publish', 'card_id', new.id));
  end if;

  return new;
end;
$$;

drop trigger if exists cards_start_trial_on_publish on public.cards;
create trigger cards_start_trial_on_publish
  after insert or update of is_published on public.cards
  for each row execute function public.start_trial_on_publish();

-- ── מנוי שממתין לפרסום נחשב בתוקף ─────────────────────────────────────────
create or replace function public.subscription_live(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.status = 'active' then true
      -- התנסות שטרם התחילה: העריכה פתוחה, הספירה תתחיל בפרסום.
      when s.status = 'trialing' and s.trial_pending then true
      when s.status = 'trialing' and s.current_period_end > now() then true
      else false
    end
    from public.subscriptions s where s.user_id = target_user
  ), false);
$$;

grant execute on function public.subscription_live(uuid) to anon, authenticated;

-- ── רשומות קיימות ─────────────────────────────────────────────────────────
-- למי שכבר פרסם כרטיס — ההתנסות התחילה; לשאר היא ממתינה.
update public.subscriptions s
set trial_pending = not exists (
      select 1 from public.cards c where c.user_id = s.user_id and c.is_published = true
    )
where s.status = 'trialing';

update public.subscriptions
set trial_started_at = coalesce(trial_started_at, created_at),
    trial_ends_at = coalesce(trial_ends_at, current_period_end)
where status = 'trialing' and trial_pending = false;
