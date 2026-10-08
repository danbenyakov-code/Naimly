-- תיקון ל-033: הפעלת מנוי שלא עברה דרך בקשת תשלום.
--
-- הבעיה: מנוי יכול להיות מופעל גם ישירות על ידי מנהל (מסך הלקוחות,
-- scripts/create-user.mjs), בלי payment_request. sync_lifecycle_events
-- הסתכלה רק על בקשות תשלום, ולכן רשמה "הניסיון הסתיים" ללקוח שהופעל
-- ידנית לפני סוף ההתנסות. גם בציר הזמן לא הופיע שום אירוע הפעלה.
--
-- התיקון:
--   1. אירוע חדש, subscription_activated, בכל הפעלה או הארכה של מנוי
--      (טריגר על subscriptions), ושחזור מ-admin_audit_log.
--   2. "התשלום הראשון" כולל גם הפעלה ידנית.
--   3. מחיקת אירועי trial_expired שנרשמו בטעות.
--
-- Rollback:
--   להחיל מחדש את הגדרות sync_lifecycle_events, user_events_subscription_change
--   ו-admin_users_overview מ-033, ולהסיר את 'subscription_activated' מה-check.

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (event_type in (
  'signed_up', 'email_verified', 'logged_in', 'app_visit', 'plan_selected',
  'card_created', 'card_first_edit', 'card_published', 'card_unpublished', 'card_deleted',
  'card_first_view', 'first_lead_received',
  'payment_requested', 'payment_completed', 'subscription_activated', 'trial_expired', 'subscription_expired',
  'email_sent', 'unsubscribed'
));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. רגע ההפעלה הראשונה של מנוי בתשלום, מכל מקור
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.first_activation_at(target_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(t) from (
    select min(p.activated_at) as t from public.payment_requests p
    where p.user_id = target_user and p.activated_at is not null and p.plan_id <> 'extra_card'
    union all
    select min(e.created_at) from public.user_events e
    where e.user_id = target_user and e.event_type = 'subscription_activated'
    union all
    select min(l.created_at) from public.admin_audit_log l
    where l.entity_id = target_user::text and l.action in ('subscription.activate', 'subscription.manual_activate')
  ) x;
$$;

revoke execute on function public.first_activation_at(uuid) from public, anon, authenticated;
grant execute on function public.first_activation_at(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. הטריגר על subscriptions: גם הפעלה והארכה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_events_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan_selected_at is not null
     and (tg_op = 'INSERT' or old.plan_selected_at is null) then
    perform public.log_user_event(new.user_id, 'plan_selected',
      jsonb_build_object(
        'choice', case when new.trial_started_at is not null and new.status = 'trialing' then 'trial' else 'paid' end,
        'plan', new.plan_id,
        'trial_ends_at', new.trial_ends_at),
      new.plan_selected_at);
  end if;

  -- הפעלה (מעבר ל-active) או הארכה (תאריך התפוגה זז קדימה), מכל מקור.
  if new.status = 'active'
     and (tg_op = 'INSERT'
          or old.status is distinct from 'active'
          or new.current_period_end > coalesce(old.current_period_end, '-infinity'::timestamptz)
          or new.plan_id is distinct from old.plan_id) then
    perform public.log_user_event(new.user_id, 'subscription_activated',
      jsonb_build_object('plan', new.plan_id, 'period_end', new.current_period_end,
                         'renewal', tg_op = 'UPDATE' and old.status = 'active'));
  end if;

  -- renewal_reminder_period_end מתעדכן רק אחרי שליחה מוצלחת (ראו הקרון).
  if tg_op = 'UPDATE' and new.renewal_reminder_period_end is not null
     and new.renewal_reminder_period_end is distinct from old.renewal_reminder_period_end then
    perform public.log_user_event(new.user_id, 'email_sent',
      jsonb_build_object('email', 'renewal_reminder', 'period_end', new.renewal_reminder_period_end));
  end if;
  return new;
exception when others then
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. סנכרון התפוגות: התנסות "פגה" רק אם לא הופעל מנוי לפני סופה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_lifecycle_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer := 0;
  added integer;
begin
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select s.user_id, 'trial_expired', jsonb_build_object('trial_ends_at', s.trial_ends_at), s.trial_ends_at
  from public.subscriptions s
  where s.trial_started_at is not null
    and s.trial_ends_at is not null
    and s.trial_ends_at < now()
    and s.trial_ends_at < coalesce(public.first_activation_at(s.user_id), 'infinity'::timestamptz)
    and not exists (
      select 1 from public.user_events e where e.user_id = s.user_id and e.event_type = 'trial_expired'
    );
  get diagnostics added = row_count;
  inserted := inserted + added;

  insert into public.user_events (user_id, event_type, metadata, created_at)
  select s.user_id, 'subscription_expired',
         jsonb_build_object('plan', s.plan_id, 'period_end', s.current_period_end), s.current_period_end
  from public.subscriptions s
  where s.status = 'active'
    and s.current_period_end is not null
    and s.current_period_end < now()
    and not exists (
      select 1 from public.user_events e
      where e.user_id = s.user_id and e.event_type = 'subscription_expired'
        and (e.metadata ->> 'period_end')::timestamptz = s.current_period_end
    );
  get diagnostics added = row_count;
  inserted := inserted + added;

  return inserted;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. שחזור הפעלות קודמות מיומן הניהול (השעה מדויקת), וניקוי השגויים
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.user_events (user_id, event_type, metadata, created_at)
select p.id, 'subscription_activated',
       jsonb_build_object('source', 'backfill', 'plan', l.details ->> 'plan', 'months', l.details -> 'months'),
       l.created_at
from public.admin_audit_log l
join public.profiles p on p.id::text = l.entity_id
where l.action in ('subscription.activate', 'subscription.manual_activate')
  and not exists (
    select 1 from public.user_events e
    where e.user_id = p.id and e.event_type = 'subscription_activated'
      and abs(extract(epoch from (e.created_at - l.created_at))) < 60
  );

delete from public.user_events e
using public.subscriptions s
where e.event_type = 'trial_expired'
  and s.user_id = e.user_id
  and s.trial_ends_at is not null
  and public.first_activation_at(e.user_id) <= s.trial_ends_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. מסך הבקרה: "שילם לראשונה" כולל הפעלה ידנית
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_users_overview(target_user uuid default null)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  created_by_admin boolean,
  profile_phone text,
  signed_up_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  plan_id text,
  subscription_status text,
  plan_selected_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  admin_locked boolean,
  card_count integer,
  published_count integer,
  primary_card_slug text,
  primary_business_name text,
  primary_card_published boolean,
  card_phone text,
  card_whatsapp text,
  payment_phone text,
  open_payment_status text,
  first_payment_at timestamptz,
  views bigint,
  clicks bigint,
  leads bigint,
  last_activity_type text,
  last_activity_at timestamptz,
  last_app_visit_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with event_totals as (
    select ce.card_id,
           count(*) filter (where ce.event_type in ('view', 'qr_scan')) as views,
           count(*) filter (where ce.event_type not in ('view', 'qr_scan', 'lead')) as clicks
    from public.card_events ce
    group by ce.card_id
  ),
  lead_totals as (
    select l.card_id, count(*) as leads from public.leads l group by l.card_id
  ),
  card_totals as (
    select c.user_id,
           count(*)::integer as card_count,
           count(*) filter (where c.is_published)::integer as published_count,
           coalesce(sum(et.views), 0)::bigint as views,
           coalesce(sum(et.clicks), 0)::bigint as clicks,
           coalesce(sum(lt.leads), 0)::bigint as leads
    from public.cards c
    left join event_totals et on et.card_id = c.id
    left join lead_totals lt on lt.card_id = c.id
    group by c.user_id
  )
  select
    p.id,
    p.full_name,
    coalesce(nullif(p.email, ''), u.email::text, ''),
    p.role,
    coalesce(p.created_by_admin, false),
    coalesce(p.phone, ''),
    p.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    s.plan_id,
    s.status,
    s.plan_selected_at,
    s.trial_started_at,
    s.trial_ends_at,
    s.current_period_end,
    coalesce(s.admin_locked, false),
    coalesce(ct.card_count, 0),
    coalesce(ct.published_count, 0),
    pc.slug,
    pc.business_name,
    pc.is_published,
    coalesce(pc.phone, ''),
    coalesce(pc.whatsapp, ''),
    coalesce(pp.contact_phone, ''),
    op.status,
    public.first_activation_at(p.id),
    coalesce(ct.views, 0),
    coalesce(ct.clicks, 0),
    coalesce(ct.leads, 0),
    la.event_type,
    la.created_at,
    av.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id
  left join card_totals ct on ct.user_id = p.id
  left join lateral (
    select c.slug, c.business_name, c.is_published, c.phone, c.whatsapp
    from public.cards c
    where c.user_id = p.id
    order by c.is_published desc, c.created_at asc
    limit 1
  ) pc on true
  left join lateral (
    select r.contact_phone from public.payment_requests r
    where r.user_id = p.id and coalesce(r.contact_phone, '') <> ''
    order by r.created_at desc limit 1
  ) pp on true
  left join lateral (
    select r.status from public.payment_requests r
    where r.user_id = p.id
      and r.status in ('pending_admin_review', 'awaiting_payment_link', 'payment_link_sent',
                       'customer_reported_paid', 'payment_verification', 'paid_pending_activation')
    order by r.created_at desc limit 1
  ) op on true
  left join lateral (
    select e.event_type, e.created_at from public.user_events e
    where e.user_id = p.id
      and e.event_type not in ('email_sent', 'trial_expired', 'subscription_expired', 'subscription_activated')
    order by e.created_at desc limit 1
  ) la on true
  left join lateral (
    select e.created_at from public.user_events e
    where e.user_id = p.id and e.event_type = 'app_visit'
    order by e.created_at desc limit 1
  ) av on true
  where target_user is null or p.id = target_user
  order by p.created_at desc;
$$;

revoke execute on function public.admin_users_overview(uuid) from public, anon, authenticated;
grant execute on function public.admin_users_overview(uuid) to service_role;
