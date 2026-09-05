-- אכיפת מסלולים ותקופת התנסות ברמת מסד הנתונים.
--
-- הרקע: /api/cards כותב עם ה‑session של המשתמש ומפתח ה‑anon הציבורי. לכן כל
-- לקוח יכול לפנות ישירות ל‑PostgREST ולעקוף את בדיקות המסלול שמבוצעות ב‑route.
-- הבדיקות כאן הן הגבול האמיתי; ה‑UI וה‑API רק משקפים אותן.

-- 1. מגבלות לכל מסלול, במקום אחד. חייב להישאר תואם ל‑src/lib/config.ts
--    ול‑src/lib/plan-access.ts.
create table if not exists public.plan_limits (
  plan_id text primary key check (plan_id in ('trial', 'basic', 'pro', 'premium')),
  max_cards smallint not null,
  max_gallery_items smallint not null,
  max_quick_actions smallint not null,
  max_files smallint not null,
  analytics_days integer not null,
  allow_tracking boolean not null,
  allow_carousel boolean not null,
  allow_video boolean not null,
  allow_files boolean not null,
  allow_lead_export boolean not null,
  allow_advanced_seo boolean not null default false
);

alter table public.plan_limits add column if not exists allow_advanced_seo boolean not null default false;

insert into public.plan_limits (plan_id, max_cards, max_gallery_items, max_quick_actions, max_files, analytics_days, allow_tracking, allow_carousel, allow_video, allow_files, allow_lead_export, allow_advanced_seo)
values
  ('trial',   1, 3,   3, 0,  7,   false, false, false, false, false, false),
  ('basic',   1, 10,  3, 0,  30,  false, false, true,  false, false, false),
  ('pro',     1, 30,  6, 10, 365, true,  true,  true,  true,  false, true),
  ('premium', 1, 100, 9, 30, 730, true,  true,  true,  true,  true,  true)
on conflict (plan_id) do update set
  max_cards = excluded.max_cards,
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

alter table public.plan_limits enable row level security;
drop policy if exists "plan_limits_public_read" on public.plan_limits;
create policy "plan_limits_public_read" on public.plan_limits for select to anon, authenticated using (true);

-- 2. המסלול האפקטיבי של משתמש: המנוי קובע, ורק כשהוא בתוקף.
--    התנסות שפג תוקפה חוזרת ל‑'trial' ומאבדת את הרשאת הפרסום.
create or replace function public.effective_plan(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.status = 'active' then s.plan_id
    when s.status = 'trialing' and s.current_period_end > now() then s.plan_id
    else 'trial'
  end
  from public.subscriptions s
  where s.user_id = target_user;
$$;

create or replace function public.subscription_live(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.status = 'active' or (s.status = 'trialing' and s.current_period_end > now())
     from public.subscriptions s where s.user_id = target_user),
    false);
$$;

grant execute on function public.effective_plan(uuid) to authenticated;
grant execute on function public.subscription_live(uuid) to anon, authenticated;

-- 3. הטריגר שאוכף בפועל. פועל על insert ועל update של cards.
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
  -- כתיבה עם service-role (webhook, כלי ניהול) עוקפת את האכיפה במכוון.
  if auth.uid() is null then
    return new;
  end if;

  plan := coalesce(public.effective_plan(new.user_id), 'trial');
  select * into lim from public.plan_limits where plan_id = plan;
  if not found then
    select * into lim from public.plan_limits where plan_id = 'trial';
  end if;

  if not public.subscription_live(new.user_id) and new.is_published then
    raise exception 'PLAN_LIMIT:subscription:תקופת ההתנסות הסתיימה. יש לבחור מסלול כדי לפרסם את הכרטיס.'
      using errcode = 'check_violation';
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

drop trigger if exists cards_enforce_plan_limits on public.cards;
create trigger cards_enforce_plan_limits
  before insert or update on public.cards
  for each row execute function public.enforce_plan_limits();

-- 4. חסימת שינוי בעלות על כרטיס קיים.
create or replace function public.lock_card_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from old.user_id then
    raise exception 'לא ניתן להעביר בעלות על כרטיס.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists cards_lock_owner on public.cards;
create trigger cards_lock_owner before update on public.cards
  for each row execute function public.lock_card_owner();

-- 5. קריאה ציבורית של כרטיס מוגבלת לבעלי מנוי בתוקף, בהתאמה ל‑getPublicCard.
drop policy if exists "cards_public_read_published" on public.cards;
create policy "cards_public_read_published" on public.cards
  for select to anon, authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (is_published = true and public.subscription_live(user_id))
  );

-- 6. ההתנסות מקבלת חותמות זמן מפורשות, כדי שהטיימר בממשק יציג נתון אמיתי
--    ולא יסתמך על current_period_end בלבד.
alter table public.subscriptions add column if not exists trial_started_at timestamptz;
alter table public.subscriptions add column if not exists trial_ends_at timestamptz;

update public.subscriptions
set trial_ends_at = coalesce(trial_ends_at, current_period_end),
    trial_started_at = coalesce(trial_started_at, created_at)
where provider = 'trial' or status = 'trialing';

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

  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, trial_started_at, trial_ends_at)
  values (new.id, 'trial', 'trialing', 'trial', now() + interval '14 days', now(), now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 7. אינדקסים לשאילתות שנוספו.
create index if not exists subscriptions_status_idx on public.subscriptions(status, current_period_end);
