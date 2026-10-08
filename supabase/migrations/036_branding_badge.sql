-- תג "נבנה ב־NAIMLY" בכרטיס, מדידת הלחיצות עליו, ומקור ההרשמה.
--
-- 1. cards.hide_branding: בקשת הסתרה של בעל הכרטיס. האכיפה בשרת, ברינדור
--    הכרטיס הציבורי: התג מוסתר רק כשבעל הכרטיס במסלול פרימיום בתשלום.
--    כך שנמוך מפרימיום מחזיר את התג מיד, בלי לגעת בנתונים.
-- 2. card_events: אירוע badge_click. הוא אינו "לחיצה" של לקוח של העסק,
--    ולכן אינו נספר בלחיצות של בעל הכרטיס (בדשבורד, במיילים ובבקרה).
-- 3. מקור ההרשמה (utm) נשמר בהרשמה ב-raw_user_meta_data.attribution,
--    ונרשם על אירוע signed_up. כך רואים כמה הרשמות הגיעו מכרטיסים.
--
-- Rollback:
--   alter table public.cards drop column if exists hide_branding;
--   (להחזיר את ה-check של card_events מ-002, ואת הפונקציות מ-033/034/035)

alter table public.cards add column if not exists hide_branding boolean not null default false;
comment on column public.cards.hide_branding is
  'בקשת בעל הכרטיס להסתיר את תג NAIMLY. נאכף ברינדור: מכובד רק במסלול פרימיום בתשלום.';
grant update (hide_branding) on public.cards to authenticated;

alter table public.card_events drop constraint if exists card_events_event_type_check;
alter table public.card_events add constraint card_events_event_type_check check (
  event_type in ('view', 'qr_scan', 'phone', 'whatsapp', 'whatsapp_primary', 'email', 'contact_save', 'map', 'waze', 'google_maps', 'website', 'share', 'social', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'calendar', 'button', 'video', 'file', 'lead', 'badge_click')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- "נרשם" נושא את מקור ההרשמה
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_events_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attribution jsonb;
begin
  select u.raw_user_meta_data -> 'attribution' into attribution from auth.users u where u.id = new.id;
  perform public.log_user_event(new.id, 'signed_up',
    case when jsonb_typeof(attribution) = 'object' then jsonb_build_object('attribution', attribution) else '{}'::jsonb end,
    new.created_at);
  return new;
exception when others then
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- לחיצות: בלי לחיצות על התג
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_card_stats(target_user uuid, since timestamptz, until timestamptz default now())
returns table (
  views bigint,
  clicks bigint,
  whatsapp bigint,
  phone bigint,
  navigation bigint,
  contact_save bigint,
  leads bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where ce.event_type in ('view', 'qr_scan')),
    count(*) filter (where ce.event_type not in ('view', 'qr_scan', 'lead', 'badge_click')),
    count(*) filter (where ce.event_type in ('whatsapp', 'whatsapp_primary')),
    count(*) filter (where ce.event_type = 'phone'),
    count(*) filter (where ce.event_type in ('waze', 'google_maps', 'map')),
    count(*) filter (where ce.event_type = 'contact_save'),
    (select count(*) from public.leads l join public.cards c2 on c2.id = l.card_id
      where c2.user_id = target_user and l.created_at >= since and l.created_at < until)
  from public.card_events ce
  join public.cards c on c.id = ce.card_id
  where c.user_id = target_user and ce.created_at >= since and ce.created_at < until;
$$;

revoke execute on function public.user_card_stats(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.user_card_stats(uuid, timestamptz, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- מסך הבקרה: מקור ההרשמה, ולחיצות בלי התג. סוג ההחזרה משתנה, ולכן drop.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.admin_users_overview(uuid);

create function public.admin_users_overview(target_user uuid default null)
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
  last_app_visit_at timestamptz,
  signup_source text,
  signup_medium text,
  signup_campaign text
)
language sql
stable
security definer
set search_path = ''
as $$
  with event_totals as (
    select ce.card_id,
           count(*) filter (where ce.event_type in ('view', 'qr_scan')) as views,
           count(*) filter (where ce.event_type not in ('view', 'qr_scan', 'lead', 'badge_click')) as clicks
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
    av.created_at,
    u.raw_user_meta_data -> 'attribution' ->> 'source',
    u.raw_user_meta_data -> 'attribution' ->> 'medium',
    u.raw_user_meta_data -> 'attribution' ->> 'campaign'
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
