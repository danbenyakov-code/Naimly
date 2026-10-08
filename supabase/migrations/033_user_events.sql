-- יומן אירועים לכל משתמש, לבקרת אימוץ המוצר (מסך /admin/users).
--
-- הרעיון: כל רגע משמעותי במסע הלקוח נרשם כשורה אחת, עם השעה המדויקת שבה
-- קרה. הרישום מתבצע בטריגרים במסד ולא בקוד האפליקציה, משתי סיבות:
--   1. הוא לא יכול "להישכח" בנתיב קוד חדש. כל כתיבה לטבלה נתפסת.
--   2. הוא לא משנה אף זרימה קיימת (הרשמה, בונה, תשלום). הקוד לא נגע.
--
-- כלל ברזל: רישום אירוע לעולם אינו מפיל את הפעולה שגרמה לו. כל כתיבה
-- עוברת דרך log_user_event, שבולעת כל שגיאה (subtransaction) ומשאירה
-- אזהרה בלוג. התחברות שנכשלת בגלל יומן היא תקלה חמורה בהרבה מאירוע חסר.
--
-- השחזור לאחור כולל רק אירועים שהשעה שלהם ידועה בוודאות. אין הערכות.
--
-- Rollback:
--   drop trigger if exists user_events_on_auth_insert on auth.users;
--   drop trigger if exists user_events_on_auth_update on auth.users;
--   drop trigger if exists user_events_on_profile_insert on public.profiles;
--   drop trigger if exists user_events_on_card_insert on public.cards;
--   drop trigger if exists user_events_on_card_update on public.cards;
--   drop trigger if exists user_events_on_card_delete on public.cards;
--   drop trigger if exists user_events_on_card_event on public.card_events;
--   drop trigger if exists user_events_on_lead_insert on public.leads;
--   drop trigger if exists user_events_on_lead_update on public.leads;
--   drop trigger if exists user_events_on_subscription on public.subscriptions;
--   drop trigger if exists user_events_on_payment_request on public.payment_requests;
--   drop function if exists public.admin_users_overview(uuid);
--   drop function if exists public.sync_lifecycle_events();
--   drop function if exists public.record_app_visit(uuid);
--   drop function if exists public.log_user_event(uuid, text, jsonb, timestamptz);
--   (ופונקציות הטריגר user_events_*)
--   drop table if exists public.user_events;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. הטבלה
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'signed_up', 'email_verified', 'logged_in', 'app_visit', 'plan_selected',
    'card_created', 'card_first_edit', 'card_published', 'card_unpublished', 'card_deleted',
    'card_first_view', 'first_lead_received',
    'payment_requested', 'payment_completed', 'trial_expired', 'subscription_expired',
    'email_sent', 'unsubscribed'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.user_events is
  'יומן מסע הלקוח. נכתב רק בשרת (טריגרים ומפתח השירות). created_at = מתי האירוע קרה בפועל.';

create index if not exists user_events_user_created_idx on public.user_events(user_id, created_at desc);
create index if not exists user_events_user_type_idx on public.user_events(user_id, event_type);
create index if not exists user_events_type_created_idx on public.user_events(event_type, created_at desc);

alter table public.user_events enable row level security;

-- משתמש רגיל לא קורא ולא כותב. מנהל קורא. כתיבה רק בשרת.
drop policy if exists "user_events_admin_read" on public.user_events;
create policy "user_events_admin_read" on public.user_events
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.user_events from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. כתיבת אירוע: לעולם לא מפילה את הפעולה שקראה לה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.log_user_event(
  target_user uuid,
  kind text,
  details jsonb default '{}'::jsonb,
  happened_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user is null or kind is null then
    return;
  end if;
  insert into public.user_events (user_id, event_type, metadata, created_at)
  values (target_user, kind, coalesce(details, '{}'::jsonb), coalesce(happened_at, now()));
exception when others then
  raise warning 'log_user_event(%): %', kind, sqlerrm;
end;
$$;

revoke execute on function public.log_user_event(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.log_user_event(uuid, text, jsonb, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. הרשמה, אימות, התחברות ומיילי Supabase Auth
-- ─────────────────────────────────────────────────────────────────────────────
-- הפרופיל נוצר בטריגר handle_new_user, ולכן "נרשם" נרשם עליו: כך מפתח
-- הזר (user_events → profiles) תמיד קיים.
create or replace function public.user_events_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_user_event(new.id, 'signed_up', '{}'::jsonb, new.created_at);
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists user_events_on_profile_insert on public.profiles;
create trigger user_events_on_profile_insert
  after insert on public.profiles
  for each row execute function public.user_events_profile_insert();

/*
 * auth.users מתעדכנת על ידי Supabase Auth בכל התחברות (last_sign_in_at),
 * באימות מייל (email_confirmed_at) ובכל שליחת קוד (confirmation_sent_at,
 * recovery_sent_at). רענון טוקן אינו נוגע בעמודות האלה.
 *
 * הטריגר נקרא אחרי on_auth_user_created (סדר אלפביתי), כך שהפרופיל כבר
 * קיים כשנרשם האירוע הראשון.
 */
create or replace function public.user_events_auth_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform public.log_user_event(new.id, 'email_verified', '{}'::jsonb, new.email_confirmed_at);
  end if;

  if new.last_sign_in_at is not null
     and (tg_op = 'INSERT' or new.last_sign_in_at is distinct from old.last_sign_in_at) then
    perform public.log_user_event(new.id, 'logged_in', '{}'::jsonb, new.last_sign_in_at);
  end if;

  if new.confirmation_sent_at is not null
     and (tg_op = 'INSERT' or new.confirmation_sent_at is distinct from old.confirmation_sent_at) then
    perform public.log_user_event(new.id, 'email_sent', jsonb_build_object('email', 'verification_code'), new.confirmation_sent_at);
  end if;

  if new.recovery_sent_at is not null
     and (tg_op = 'INSERT' or new.recovery_sent_at is distinct from old.recovery_sent_at) then
    perform public.log_user_event(new.id, 'email_sent', jsonb_build_object('email', 'password_reset'), new.recovery_sent_at);
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists user_events_on_auth_insert on auth.users;
create trigger user_events_on_auth_insert
  after insert on auth.users
  for each row execute function public.user_events_auth_change();

drop trigger if exists user_events_on_auth_update on auth.users;
create trigger user_events_on_auth_update
  after update of email_confirmed_at, last_sign_in_at, confirmation_sent_at, recovery_sent_at on auth.users
  for each row execute function public.user_events_auth_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. כרטיסים: יצירה, עריכה ראשונה, פרסום, הסרה ומחיקה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_events_card_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_user_event(new.user_id, 'card_created',
      jsonb_build_object('card_id', new.id, 'slug', new.slug), new.created_at);
    if new.is_published then
      perform public.log_user_event(new.user_id, 'card_published',
        jsonb_build_object('card_id', new.id, 'slug', new.slug));
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.log_user_event(old.user_id, 'card_deleted',
      jsonb_build_object('card_id', old.id, 'slug', old.slug));
    return old;
  end if;

  if new.is_published is distinct from old.is_published then
    perform public.log_user_event(new.user_id,
      case when new.is_published then 'card_published' else 'card_unpublished' end,
      jsonb_build_object('card_id', new.id, 'slug', new.slug));
  end if;

  -- עריכה ראשונה = השמירה הראשונה של בעל הכרטיס עצמו (לא של מנהל או סקריפט).
  if auth.uid() is not null and auth.uid() = new.user_id
     and not exists (
       select 1 from public.user_events e
       where e.user_id = new.user_id and e.event_type = 'card_first_edit'
         and e.metadata ->> 'card_id' = new.id::text
     ) then
    perform public.log_user_event(new.user_id, 'card_first_edit',
      jsonb_build_object('card_id', new.id, 'slug', new.slug));
  end if;

  return new;
exception when others then
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists user_events_on_card_insert on public.cards;
create trigger user_events_on_card_insert
  after insert on public.cards
  for each row execute function public.user_events_card_change();

drop trigger if exists user_events_on_card_update on public.cards;
create trigger user_events_on_card_update
  after update on public.cards
  for each row execute function public.user_events_card_change();

drop trigger if exists user_events_on_card_delete on public.cards;
create trigger user_events_on_card_delete
  after delete on public.cards
  for each row execute function public.user_events_card_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. צפייה ראשונה ופנייה ראשונה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_events_card_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  card_slug text;
begin
  if new.event_type not in ('view', 'qr_scan') then
    return new;
  end if;
  select c.user_id, c.slug into owner, card_slug from public.cards c where c.id = new.card_id;
  if owner is not null and not exists (
    select 1 from public.user_events e where e.user_id = owner and e.event_type = 'card_first_view'
  ) then
    perform public.log_user_event(owner, 'card_first_view',
      jsonb_build_object('card_id', new.card_id, 'slug', card_slug, 'source', new.event_type), new.created_at);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists user_events_on_card_event on public.card_events;
create trigger user_events_on_card_event
  after insert on public.card_events
  for each row execute function public.user_events_card_event();

create or replace function public.user_events_lead_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select c.user_id into owner from public.cards c where c.id = new.card_id;
  if owner is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.user_events e where e.user_id = owner and e.event_type = 'first_lead_received'
    ) then
      perform public.log_user_event(owner, 'first_lead_received',
        jsonb_build_object('card_id', new.card_id, 'lead_id', new.id), new.created_at);
    end if;
    return new;
  end if;

  -- מייל ההתראה על הפנייה נמסר לספק בהצלחה (ראו /api/leads).
  if new.notification_status = 'sent' and old.notification_status is distinct from 'sent' then
    perform public.log_user_event(owner, 'email_sent',
      jsonb_build_object('email', 'lead_notification', 'lead_id', new.id),
      coalesce(new.notification_at, now()));
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists user_events_on_lead_insert on public.leads;
create trigger user_events_on_lead_insert
  after insert on public.leads
  for each row execute function public.user_events_lead_change();

drop trigger if exists user_events_on_lead_update on public.leads;
create trigger user_events_on_lead_update
  after update of notification_status on public.leads
  for each row execute function public.user_events_lead_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. בחירת מסלול ותזכורת חידוש
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

drop trigger if exists user_events_on_subscription on public.subscriptions;
create trigger user_events_on_subscription
  after insert or update on public.subscriptions
  for each row execute function public.user_events_subscription_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. בקשת תשלום ותשלום שהושלם
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_events_payment_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_user_event(new.user_id, 'payment_requested',
      jsonb_build_object('request_id', new.id, 'reference', new.reference, 'plan', new.plan_id,
                         'cycle', new.billing_cycle, 'amount', new.amount),
      new.created_at);
    return new;
  end if;

  if new.status = 'active' and old.status is distinct from 'active' then
    perform public.log_user_event(new.user_id, 'payment_completed',
      jsonb_build_object('request_id', new.id, 'reference', new.reference, 'plan', new.plan_id,
                         'cycle', new.billing_cycle, 'amount', new.amount),
      coalesce(new.activated_at, now()));
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists user_events_on_payment_request on public.payment_requests;
create trigger user_events_on_payment_request
  after insert or update on public.payment_requests
  for each row execute function public.user_events_payment_request_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. תפוגה: אין רגע "כתיבה" שבו ההתנסות מסתיימת, ולכן אירועי התפוגה
--    נוצרים בסנכרון. השעה שנרשמת היא שעת התפוגה האמיתית, לא שעת הריצה,
--    כך שהתוצאה מדויקת בלי קשר למתי הסנכרון רץ. הפונקציה אידמפוטנטית.
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
  -- התנסות שהסתיימה לפני תשלום כלשהו. מי ששילם לפני סוף ההתנסות לא "פג".
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select s.user_id, 'trial_expired', jsonb_build_object('trial_ends_at', s.trial_ends_at), s.trial_ends_at
  from public.subscriptions s
  where s.trial_started_at is not null
    and s.trial_ends_at is not null
    and s.trial_ends_at < now()
    and s.trial_ends_at < coalesce((
      select min(p.activated_at) from public.payment_requests p
      where p.user_id = s.user_id and p.activated_at is not null and p.plan_id <> 'extra_card'
    ), 'infinity'::timestamptz)
    and not exists (
      select 1 from public.user_events e where e.user_id = s.user_id and e.event_type = 'trial_expired'
    );
  get diagnostics added = row_count;
  inserted := inserted + added;

  -- מנוי בתשלום שתוקפו עבר, פעם אחת לכל תאריך תפוגה.
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

revoke execute on function public.sync_lifecycle_events() from public, anon, authenticated;
grant execute on function public.sync_lifecycle_events() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. "נכנס למערכת": משתמש שנשאר מחובר לא מתחבר מחדש, ולכן התחברויות
--    לבדן מציגות לקוח פעיל כאילו נטש. נרשם פעם אחת ביום (שעון ישראל).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_app_visit(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Jerusalem')) at time zone 'Asia/Jerusalem';
begin
  if target_user is null then
    return false;
  end if;
  -- שתי טעינות במקביל לא ירשמו פעמיים.
  perform pg_advisory_xact_lock(hashtext('app_visit:' || target_user::text));
  if exists (
    select 1 from public.user_events e
    where e.user_id = target_user and e.event_type = 'app_visit' and e.created_at >= day_start
  ) then
    return false;
  end if;
  perform public.log_user_event(target_user, 'app_visit');
  return true;
end;
$$;

revoke execute on function public.record_app_visit(uuid) from public, anon, authenticated;
grant execute on function public.record_app_visit(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. תמונת מצב לכל משתמש, לשאילתה אחת במסך הבקרה.
--     מפתח השירות בלבד: הפונקציה קוראת מ-auth.users.
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
    fp.first_payment_at,
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
    select min(r.activated_at) as first_payment_at from public.payment_requests r
    where r.user_id = p.id and r.activated_at is not null
  ) fp on true
  left join lateral (
    -- פעילות אחרונה = משהו שהלקוח עשה, לא מייל שנשלח אליו או תפוגה.
    select e.event_type, e.created_at from public.user_events e
    where e.user_id = p.id
      and e.event_type not in ('email_sent', 'trial_expired', 'subscription_expired')
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. שחזור לאחור: רק מה שהשעה שלו ידועה בוודאות.
--     metadata.source = 'backfill' מסמן שהשורה שוחזרה, לא שהיא משוערת.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  has_auth_audit boolean := to_regclass('auth.audit_log_entries') is not null;
  backfill constant jsonb := jsonb_build_object('source', 'backfill');
begin
  if exists (select 1 from public.user_events where metadata ->> 'source' = 'backfill') then
    return;
  end if;

  -- נרשם
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select p.id, 'signed_up', backfill, p.created_at from public.profiles p;

  -- אימת מייל
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select u.id, 'email_verified', backfill, u.email_confirmed_at
  from auth.users u join public.profiles p on p.id = u.id
  where u.email_confirmed_at is not null;

  -- היסטוריית התחברויות ושליחות קוד מיומן ה-Auth של Supabase, אם נשמר.
  if has_auth_audit then
    execute $sql$
      insert into public.user_events (user_id, event_type, metadata, created_at)
      select p.id,
             case a.payload ->> 'action' when 'login' then 'logged_in' else 'email_sent' end,
             case a.payload ->> 'action'
               when 'login' then jsonb_build_object('source', 'backfill')
               when 'user_confirmation_requested' then jsonb_build_object('source', 'backfill', 'email', 'verification_code')
               else jsonb_build_object('source', 'backfill', 'email', 'password_reset')
             end,
             a.created_at
      from auth.audit_log_entries a
      join public.profiles p on p.id::text = a.payload ->> 'actor_id'
      where a.payload ->> 'action' in ('login', 'user_confirmation_requested', 'user_recovery_requested')
        and a.created_at is not null
    $sql$;
  end if;

  -- ההתחברות האחרונה תמיד ידועה, גם כשהיומן ריק. לא מכפילים אותה.
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select u.id, 'logged_in', backfill, u.last_sign_in_at
  from auth.users u join public.profiles p on p.id = u.id
  where u.last_sign_in_at is not null
    and not exists (
      select 1 from public.user_events e
      where e.user_id = u.id and e.event_type = 'logged_in'
        and abs(extract(epoch from (e.created_at - u.last_sign_in_at))) < 60
    );

  -- שליחת הקוד / האיפוס האחרונה, כשאינה כבר ביומן.
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select u.id, 'email_sent', backfill || jsonb_build_object('email', 'verification_code'), u.confirmation_sent_at
  from auth.users u join public.profiles p on p.id = u.id
  where u.confirmation_sent_at is not null
    and not exists (
      select 1 from public.user_events e
      where e.user_id = u.id and e.event_type = 'email_sent' and e.metadata ->> 'email' = 'verification_code'
        and abs(extract(epoch from (e.created_at - u.confirmation_sent_at))) < 60
    );

  insert into public.user_events (user_id, event_type, metadata, created_at)
  select u.id, 'email_sent', backfill || jsonb_build_object('email', 'password_reset'), u.recovery_sent_at
  from auth.users u join public.profiles p on p.id = u.id
  where u.recovery_sent_at is not null
    and not exists (
      select 1 from public.user_events e
      where e.user_id = u.id and e.event_type = 'email_sent' and e.metadata ->> 'email' = 'password_reset'
        and abs(extract(epoch from (e.created_at - u.recovery_sent_at))) < 60
    );

  -- בחירת מסלול
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select s.user_id, 'plan_selected',
         backfill || jsonb_build_object(
           'choice', case when coalesce(p.created_by_admin, false) then 'admin'
                          when s.trial_started_at is not null then 'trial' else 'paid' end,
           'plan', s.plan_id, 'trial_ends_at', s.trial_ends_at),
         s.plan_selected_at
  from public.subscriptions s join public.profiles p on p.id = s.user_id
  where s.plan_selected_at is not null;

  -- יצירת כרטיס (כרטיסים שנמחקו בעבר לא ניתנים לשחזור)
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select c.user_id, 'card_created', backfill || jsonb_build_object('card_id', c.id, 'slug', c.slug), c.created_at
  from public.cards c;

  -- פרסום: ידוע במדויק רק למי שההתנסות שלו התחילה בפרסום (מיגרציה 008).
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select c.user_id, 'card_published', backfill || jsonb_build_object('card_id', c.id, 'slug', c.slug), l.created_at
  from public.admin_audit_log l
  join public.cards c on c.id::text = l.details ->> 'card_id'
  where l.action = 'trial.start' and l.details ->> 'trigger' = 'first_publish';

  -- צפייה ראשונה
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select distinct on (c.user_id) c.user_id, 'card_first_view',
         backfill || jsonb_build_object('card_id', c.id, 'slug', c.slug, 'source', ce.event_type), ce.created_at
  from public.card_events ce join public.cards c on c.id = ce.card_id
  where ce.event_type in ('view', 'qr_scan')
  order by c.user_id, ce.created_at asc;

  -- פנייה ראשונה
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select distinct on (c.user_id) c.user_id, 'first_lead_received',
         backfill || jsonb_build_object('card_id', c.id, 'lead_id', l.id), l.created_at
  from public.leads l join public.cards c on c.id = l.card_id
  order by c.user_id, l.created_at asc;

  -- מיילי התראה על פנייה שנמסרו בהצלחה
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select c.user_id, 'email_sent', backfill || jsonb_build_object('email', 'lead_notification', 'lead_id', l.id), l.notification_at
  from public.leads l join public.cards c on c.id = l.card_id
  where l.notification_status = 'sent' and l.notification_at is not null;

  -- בקשות תשלום ותשלומים שהושלמו
  insert into public.user_events (user_id, event_type, metadata, created_at)
  select r.user_id, 'payment_requested',
         backfill || jsonb_build_object('request_id', r.id, 'reference', r.reference, 'plan', r.plan_id,
                                        'cycle', r.billing_cycle, 'amount', r.amount),
         r.created_at
  from public.payment_requests r;

  insert into public.user_events (user_id, event_type, metadata, created_at)
  select r.user_id, 'payment_completed',
         backfill || jsonb_build_object('request_id', r.id, 'reference', r.reference, 'plan', r.plan_id,
                                        'cycle', r.billing_cycle, 'amount', r.amount),
         r.activated_at
  from public.payment_requests r
  where r.activated_at is not null and r.status in ('active', 'refunded');

  -- תפוגות, לפי תאריך התפוגה האמיתי
  perform public.sync_lifecycle_events();
end;
$$;
