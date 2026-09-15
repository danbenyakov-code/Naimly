-- רכישת כרטיס נוסף (REQ-011).
--
-- עד כה מספר הכרטיסים נגזר אך ורק מהמסלול, ולקוח שרצה כרטיס שני מעבר
-- לזכאותו לא יכול היה לקנות אותו. תנאי הקבלה דורש "לפי זכאות החבילה
-- **או לאחר רכישה**".
--
-- המכסה האפקטיבית היא סכום: מכסת המסלול ועוד הכרטיסים שנרכשו. כך
-- שדרוג מסלול אינו מבטל רכישה, ושנמוך אינו מוחק כרטיס ששולם עליו.
--
-- Rollback:
--   alter table public.subscriptions drop column if exists extra_cards;
--   alter table public.payment_requests drop constraint if exists payment_requests_plan_id_check;
--   alter table public.payment_requests add constraint payment_requests_plan_id_check
--     check (plan_id in ('basic', 'pro', 'premium'));

alter table public.subscriptions
  add column if not exists extra_cards smallint not null default 0
  check (extra_cards >= 0 and extra_cards <= 10);

comment on column public.subscriptions.extra_cards is
  'כרטיסים שנרכשו מעבר למכסת המסלול. המכסה האפקטיבית = plan_limits.max_cards + extra_cards.';

-- ─────────────────────────────────────────────────────────────────────────────
-- בקשת תשלום עבור כרטיס נוסף
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * 'extra_card' אינו מסלול, אבל הוא עובר באותו צינור תשלום: בקשה,
 * אסמכתא, אישור מנהל. מסלול תשלום שני היה מכפיל את הלוגיקה ואת מקומות
 * הכשל.
 */
alter table public.payment_requests drop constraint if exists payment_requests_plan_id_check;
alter table public.payment_requests add constraint payment_requests_plan_id_check
  check (plan_id in ('basic', 'pro', 'premium', 'extra_card'));

-- ─────────────────────────────────────────────────────────────────────────────
-- המכסה האפקטיבית, במקום אחד
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.effective_max_cards(target_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(l.max_cards, 0) + coalesce(s.extra_cards, 0)
  from public.subscriptions s
  join public.plan_limits l on l.plan_id = public.effective_plan(target_user)
  where s.user_id = target_user;
$$;

grant execute on function public.effective_max_cards(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- הטריגר סופר לפי המכסה האפקטיבית
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
  allowed_cards integer;
  widget_types text[];
begin
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
    -- המכסה כוללת כרטיסים שנרכשו, ולא רק את זכאות המסלול.
    allowed_cards := coalesce(public.effective_max_cards(new.user_id), lim.max_cards);
    select count(*) into card_count from public.cards where user_id = new.user_id;
    if card_count >= allowed_cards then
      raise exception 'PLAN_LIMIT:cards:המסלול הנוכחי מאפשר עד % כרטיסים.', allowed_cards
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

  if jsonb_array_length(coalesce(new.files, '[]'::jsonb)) > lim.max_files then
    raise exception 'PLAN_LIMIT:files:המסלול הנוכחי מאפשר עד % קבצים.', lim.max_files
      using errcode = 'check_violation';
  end if;

  select array_agg(value ->> 'type') into widget_types
  from jsonb_array_elements(coalesce(new.widgets, '[]'::jsonb))
  where (value ->> 'enabled')::boolean is true;

  if not lim.allow_carousel and coalesce(new.gallery_style, '') = 'carousel' then
    raise exception 'PLAN_LIMIT:carousel:גלריית קרוסלה זמינה במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  if not lim.allow_files and 'files' = any(coalesce(widget_types, array[]::text[])) then
    raise exception 'PLAN_LIMIT:files:צירוף קבצים להורדה זמין במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- זיכוי כרטיס נוסף לאחר אישור תשלום
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.grant_extra_card(target_user uuid, quantity integer default 1, actor uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.subscriptions
  set extra_cards = least(10, coalesce(extra_cards, 0) + greatest(1, quantity)),
      updated_at = now()
  where user_id = target_user
  returning extra_cards into updated;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'card.extra_granted', 'user', target_user::text,
          jsonb_build_object('quantity', quantity, 'total_extra', updated));

  return updated;
end;
$$;

revoke execute on function public.grant_extra_card(uuid, integer, uuid) from public, anon, authenticated;
