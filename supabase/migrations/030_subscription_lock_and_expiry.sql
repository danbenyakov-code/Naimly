-- נעילת מנוי ידנית על ידי מנהל, ואכיפת תוקף בפועל על מנוי "active".
--
-- הבעיה שהתגלתה: effective_plan() בדקה תוקף (current_period_end) רק
-- למנוי במצב trialing. מנוי "active" זיכה גישה לצמיתות, בלי תלות
-- בתאריך — לקוח ששילם על חודש/שנה ולא חידש **לא היה ננעל אף פעם**
-- אלא אם מנהל היה מבטל ידנית. זו לא הייתה כוונה מוצהרת בשום מקום,
-- רק חוסר בדיקה.
--
-- Rollback:
--   ראו הגדרות effective_plan/subscription_live במיגרציה
--   010_plan_selection_gate.sql, והגדרת activate_purchase_request
--   במיגרציה 029_purchase_workflow.sql — החל אותן מחדש כדי לבטל את
--   השינויים כאן.
--   drop function if exists public.admin_set_subscription_lock(uuid, uuid, boolean, text);
--   alter table public.subscriptions
--     drop column if exists admin_locked, drop column if exists admin_locked_at,
--     drop column if exists admin_locked_reason, drop column if exists renewal_reminder_period_end,
--     drop column if exists billing_cycle;

alter table public.subscriptions add column if not exists admin_locked boolean not null default false;
alter table public.subscriptions add column if not exists admin_locked_at timestamptz;
alter table public.subscriptions add column if not exists admin_locked_reason text not null default '';

comment on column public.subscriptions.admin_locked is
  'נעילה ידנית של מנהל, בלי קשר לתוקף המנוי — למקרה של אי-תשלום שהתגלה מחוץ למחזור, חיוב שהתהפך, או הפרת תנאים.';

-- מזהה עבור איזה current_period_end כבר נשלחה תזכורת חידוש. כשהמנוי
-- מתחדש current_period_end משתנה, והתזכורת הבאה נשלחת מחדש אוטומטית.
alter table public.subscriptions add column if not exists renewal_reminder_period_end timestamptz;

/*
 * מחזור החיוב היה קיים רק על payment_requests (מיגרציה 015), לא על
 * המנוי הפעיל עצמו — אי אפשר היה לדעת, בלי לחפש בהיסטוריית הבקשות,
 * אם לקוח פעיל משלם חודשי או שנתי. נדרש כדי שתזכורת החידוש תציג את
 * הסכום והמחזור הנכונים.
 */
alter table public.subscriptions add column if not exists billing_cycle text not null default 'monthly'
  check (billing_cycle in ('monthly', 'annual'));

-- ─────────────────────────────────────────────────────────────────────────────
-- effective_plan / subscription_live: נעילה ידנית חוסמת תמיד; מנוי
-- "active" שתוקפו עבר מתנהג כמו שאין לו מנוי, בלי שאיש יצטרך לגעת בו.
-- current_period_end null (לא אמור לקרות בנתיב הרגיל) מתפרש כ"בלי
-- תפוגה" ולא כ"פג מיד" — הגנה מפני נעילה לא מכוונת של רשומה חריגה.
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
      when s.admin_locked then 'none'
      when s.plan_selected_at is null then 'none'
      when s.status = 'active' and coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then s.plan_id
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
      when s.admin_locked then false
      when s.plan_selected_at is null then false
      when s.status = 'active' and coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then true
      when s.status = 'trialing' and s.current_period_end > now() then true
      else false
    end
    from public.subscriptions s where s.user_id = target_user
  ), false);
$$;

grant execute on function public.subscription_live(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- נעילה/שחרור ידניים — פעולת אדמין בלבד, מתועדת ב-audit log.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_subscription_lock(
  target_user uuid,
  actor uuid,
  locked boolean,
  reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set admin_locked = locked,
      admin_locked_at = case when locked then now() else null end,
      admin_locked_reason = case when locked then coalesce(reason, '') else '' end,
      updated_at = now()
  where user_id = target_user;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, case when locked then 'subscription.lock' else 'subscription.unlock' end, 'user', target_user::text,
          jsonb_build_object('reason', reason));
end;
$$;

revoke execute on function public.admin_set_subscription_lock(uuid, uuid, boolean, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- activate_purchase_request (מיגרציה 029) מוגדרת מחדש כדי לשמור גם את
-- מחזור החיוב על המנוי עצמו — אותה לוגיקה בדיוק, שורה אחת נוספת.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.activate_purchase_request(
  request_id uuid,
  actor uuid
)
returns table (already_active boolean, plan_id text, months integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  req record;
  computed_months integer;
begin
  select * into req from public.payment_requests where id = request_id for update;
  if not found then
    raise exception 'לא נמצאה בקשה % ', request_id;
  end if;

  if req.status = 'active' then
    return query select true, req.plan_id, 0;
    return;
  end if;

  if req.status <> 'paid_pending_activation' then
    raise exception 'STATUS_TRANSITION:אפשר להפעיל רק בקשה שממתינה להפעלה (paid_pending_activation), הבקשה הזו במצב %', req.status
      using errcode = 'check_violation';
  end if;

  computed_months := case when req.billing_cycle = 'annual' then 12 else 1 end;

  if req.plan_id = 'extra_card' then
    perform public.grant_extra_card(req.user_id, 1, actor);
  else
    perform public.activate_subscription(req.user_id, req.plan_id, computed_months, actor);
    update public.subscriptions set billing_cycle = coalesce(req.billing_cycle, 'monthly') where user_id = req.user_id;
  end if;

  update public.payment_requests
  set status = 'active',
      reviewed_by = actor,
      activated_at = now(),
      updated_at = now()
  where id = request_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'payment_request.activate', 'payment_request', request_id::text,
          jsonb_build_object('plan', req.plan_id, 'months', computed_months, 'reference', req.reference));

  return query select false, req.plan_id, computed_months;
end;
$$;

revoke execute on function public.activate_purchase_request(uuid, uuid) from public, anon, authenticated;
