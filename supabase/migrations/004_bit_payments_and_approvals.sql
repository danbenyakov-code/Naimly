-- תשלום בביט דרך וואטסאפ + אישור ידני של מנהל, והתנסות עם גישה מלאה.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ההתנסות פותחת את כל היכולות, במכסות של פרימיום.
--    כשההתנסות מסתיימת ללא תשלום, effective_plan מחזיר 'none' והכול נחסם.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.plan_limits (plan_id, max_cards, max_gallery_items, max_quick_actions, max_files, analytics_days, allow_tracking, allow_carousel, allow_video, allow_files, allow_lead_export, allow_advanced_seo)
values ('trial', 1, 100, 9, 30, 730, true, true, true, true, true, true)
on conflict (plan_id) do update set
  max_gallery_items = excluded.max_gallery_items,
  max_quick_actions = excluded.max_quick_actions,
  max_files = excluded.max_files,
  analytics_days = excluded.analytics_days,
  allow_tracking = excluded.allow_tracking,
  allow_carousel = excluded.allow_carousel,
  allow_video = excluded.allow_video,
  allow_files = excluded.allow_files,
  allow_lead_export = excluded.allow_lead_export,
  allow_advanced_seo = excluded.allow_advanced_seo;

-- מסלול 'none' = לא שילם. אפס יכולות; משמש כשההתנסות פגה.
insert into public.plan_limits (plan_id, max_cards, max_gallery_items, max_quick_actions, max_files, analytics_days, allow_tracking, allow_carousel, allow_video, allow_files, allow_lead_export, allow_advanced_seo)
values ('none', 0, 0, 3, 0, 0, false, false, false, false, false, false)
on conflict (plan_id) do nothing;

alter table public.plan_limits drop constraint if exists plan_limits_plan_id_check;
alter table public.plan_limits add constraint plan_limits_plan_id_check
  check (plan_id in ('none', 'trial', 'basic', 'pro', 'premium'));

create or replace function public.effective_plan(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.status = 'active' then s.plan_id
      when s.status = 'trialing' and s.current_period_end > now() then 'trial'
      else 'none'
    end
    from public.subscriptions s
    where s.user_id = target_user
  ), 'none');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. כשלא שילם — הכול נחסם, לא רק הפרסום.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan text;
  lim public.plan_limits%rowtype;
  card_count integer;
  widget_types text[];
begin
  -- כתיבה עם service-role (webhook, אישור מנהל, כלי ניהול) עוקפת במכוון.
  if auth.uid() is null then
    return new;
  end if;

  plan := public.effective_plan(new.user_id);

  if plan = 'none' then
    raise exception 'PLAN_LIMIT:subscription:אין מנוי פעיל. יש לבחור מסלול ולהשלים תשלום כדי לערוך את הכרטיס.'
      using errcode = 'check_violation';
  end if;

  select * into lim from public.plan_limits where plan_id = plan;
  if not found then
    select * into lim from public.plan_limits where plan_id = 'basic';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into card_count from public.cards where user_id = new.user_id;
    if card_count >= lim.max_cards then
      raise exception 'PLAN_LIMIT:cards:המסלול הנוכחי מאפשר עד % כרטיסים.', lim.max_cards
        using errcode = 'check_violation';
    end if;
  end if;

  if jsonb_array_length(coalesce(new.gallery, '[]'::jsonb)) > lim.max_gallery_items then
    raise exception 'PLAN_LIMIT:gallery:המסלול הנוכחי מאפשר עד % תמונות בגלריה.', lim.max_gallery_items
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(coalesce(new.quick_actions, '[]'::jsonb)) > lim.max_quick_actions
     or new.quick_actions_limit > lim.max_quick_actions then
    raise exception 'PLAN_LIMIT:quickActions:המסלול הנוכחי מאפשר עד % פעולות מהירות.', lim.max_quick_actions
      using errcode = 'check_violation';
  end if;

  if not lim.allow_tracking and concat(
       new.tracking ->> 'googleAnalyticsId',
       new.tracking ->> 'googleTagManagerId',
       new.tracking ->> 'metaPixelId') <> '' then
    raise exception 'PLAN_LIMIT:tracking:חיבור Meta Pixel ו-Google Analytics זמין במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  if not lim.allow_advanced_seo and (coalesce(new.area_served, '') <> '' or coalesce(new.social_image_url, '') <> '') then
    raise exception 'PLAN_LIMIT:seo:אזור שירות ותמונת שיתוף מותאמת זמינים במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  if not lim.allow_carousel and new.gallery_style = 'carousel' then
    raise exception 'PLAN_LIMIT:carousel:גלריית קרוסלה זמינה במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  select array_agg(value ->> 'type') into widget_types
  from jsonb_array_elements(coalesce(new.widgets, '[]'::jsonb))
  where (value ->> 'enabled')::boolean is true;

  if not lim.allow_video and 'video' = any(coalesce(widget_types, array[]::text[])) then
    raise exception 'PLAN_LIMIT:video:וידג׳ט הסרטון זמין במסלול בסיסי ומעלה.'
      using errcode = 'check_violation';
  end if;

  if not lim.allow_files and (jsonb_array_length(coalesce(new.files, '[]'::jsonb)) > 0
       or 'files' = any(coalesce(widget_types, array[]::text[]))) then
    raise exception 'PLAN_LIMIT:files:צירוף קבצים להורדה זמין במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(coalesce(new.files, '[]'::jsonb)) > lim.max_files then
    raise exception 'PLAN_LIMIT:files:המסלול הנוכחי מאפשר עד % קבצים.', lim.max_files
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. בקשות תשלום (ביט/וואטסאפ) שממתינות לאישור מנהל.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference text not null unique,
  plan_id text not null check (plan_id in ('basic', 'pro', 'premium')),
  amount numeric(10, 2) not null,
  method text not null default 'bit' check (method in ('bit', 'bank_transfer', 'cash', 'other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  contact_phone text not null default '',
  note text not null default '',
  admin_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_requests_status_idx on public.payment_requests(status, created_at desc);
create index if not exists payment_requests_user_idx on public.payment_requests(user_id, created_at desc);

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at before update on public.payment_requests
  for each row execute function public.set_updated_at();

alter table public.payment_requests enable row level security;

-- הלקוח רואה רק את הבקשות שלו. יצירה ואישור עוברים דרך ה־API בלבד.
drop policy if exists "payment_requests_read_own" on public.payment_requests;
create policy "payment_requests_read_own" on public.payment_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. פרופיל: מספר וואטסאפ לשליחת פרטי התחברות, וסימון אישור ידני.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists credentials_sent_at timestamptz;
alter table public.profiles add column if not exists created_by_admin boolean not null default false;

grant update (full_name, phone, updated_at) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. הפעלת מנוי לאחר אישור מנהל — פונקציה אחת שמרכזת את כל השינויים.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.activate_subscription(
  target_user uuid,
  target_plan text,
  months integer default 1,
  actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end)
  values (target_user, target_plan, 'active', 'bit', now() + (months || ' months')::interval)
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    provider = 'bit',
    current_period_end = excluded.current_period_end,
    updated_at = now();

  update public.profiles
  set plan_id = target_plan, approved_at = coalesce(approved_at, now()), updated_at = now()
  where id = target_user;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'subscription.activate', 'user', target_user::text,
          jsonb_build_object('plan', target_plan, 'months', months));
end;
$$;

revoke execute on function public.activate_subscription(uuid, text, integer, uuid) from public, anon, authenticated;
