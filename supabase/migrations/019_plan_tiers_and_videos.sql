-- מכסות חדשות למסלולים, מגבלת סרטונים וכרטיס נוסף בפרימיום.
--
-- שלוש סיבות לשינוי:
--
-- 1. "100 תמונות" אינה מכסה אלא הצהרה חסרת משמעות. בעל עסק לא מעלה
--    מאה תמונות, והמספר רק מטשטש את ההבדל בין המסלולים. המכסות הוקטנו
--    למספרים שאפשר להבין ולהשוות.
--
-- 2. וידאו היה בוליאני, ולכן אי אפשר היה לומר "סרטון אחד" מול "שני
--    סרטונים" — ההבדל בין מקצועי לפרימיום לא היה ניתן לניסוח.
--
-- 3. REQ-011: פרימיום כולל כרטיס שני. האכיפה כבר קיימת בטריגר על
--    max_cards, ולכן די בעדכון המכסה.
--
-- הידוק שיש להכיר: basic מאבד את הרשאת הווידאו. כרטיס בסיסי שכבר
-- מחזיק סרטון ייגזם בשמירה הבאה על ידי clampCardToPlan, ולא ייחסם.
--
-- Rollback:
--   alter table public.plan_limits drop column if exists max_videos;
--   alter table public.cards drop column if exists videos;
--   (ולהחזיר את הערכים הקודמים ב-plan_limits)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. מגבלת סרטונים
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.plan_limits add column if not exists max_videos smallint not null default 0;

/*
 * מערך הסרטונים. videoUrl הישן נשאר בשדה שלו לצורך תאימות, והקוד
 * ממזג אותו כאיבר ראשון — מחיקת עמודה במסד חי מאבדת מידע של לקוחות
 * קיימים בלי דרך חזרה.
 */
alter table public.cards add column if not exists videos jsonb not null default '[]'::jsonb;

comment on column public.cards.videos is
  'רשימת קישורי וידאו. האיבר הראשון גובר על video_url הישן.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. המכסות החדשות
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.plan_limits (
  plan_id, max_cards, max_gallery_items, max_quick_actions, max_files, max_videos,
  analytics_days, allow_tracking, allow_carousel, allow_video, allow_files,
  allow_lead_export, allow_advanced_seo
)
values
  -- ההתנסות מקבלת את יכולות פרימיום, אך כרטיס אחד בלבד: כרטיס שני
  -- שנפתח בהתנסות והיה נסגר בסיומה הוא הבטחה שנשברת.
  ('trial',   1, 24, 9, 10, 2, 730, true,  true,  true,  true,  true,  true),
  ('basic',   1,  6, 3,  0, 0,  30, false, false, false, false, false, false),
  ('pro',     1, 12, 6,  3, 1, 365, true,  true,  true,  true,  false, true),
  ('premium', 2, 24, 9, 10, 2, 730, true,  true,  true,  true,  true,  true)
on conflict (plan_id) do update set
  max_cards = excluded.max_cards,
  max_gallery_items = excluded.max_gallery_items,
  max_quick_actions = excluded.max_quick_actions,
  max_files = excluded.max_files,
  max_videos = excluded.max_videos,
  analytics_days = excluded.analytics_days,
  allow_tracking = excluded.allow_tracking,
  allow_carousel = excluded.allow_carousel,
  allow_video = excluded.allow_video,
  allow_files = excluded.allow_files,
  allow_lead_export = excluded.allow_lead_export,
  allow_advanced_seo = excluded.allow_advanced_seo;

-- 'none' = מסלול שלא נבחר או שפג. נשאר חסום לחלוטין.
update public.plan_limits set max_videos = 0 where plan_id = 'none';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. אכיפת מספר הסרטונים בטריגר
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * נוסף לאכיפה הקיימת. בלי זה המכסה החדשה הייתה מוצגת במחירון ולא
 * נאכפת בפועל — בקשה ישירה ל-API הייתה שומרת כמה סרטונים שרוצים.
 */
create or replace function public.enforce_video_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan text;
  lim public.plan_limits%rowtype;
  video_count integer;
begin
  -- כתיבה עם service-role עוקפת את האכיפה במכוון, כמו בטריגר הראשי.
  if auth.uid() is null then
    return new;
  end if;

  plan := coalesce(public.effective_plan(new.user_id), 'trial');
  select * into lim from public.plan_limits where plan_id = plan;
  if not found then
    select * into lim from public.plan_limits where plan_id = 'trial';
  end if;

  video_count := jsonb_array_length(coalesce(new.videos, '[]'::jsonb));
  if coalesce(new.video_url, '') <> '' and video_count = 0 then
    video_count := 1;
  end if;

  if video_count > lim.max_videos then
    if lim.max_videos = 0 then
      raise exception 'PLAN_LIMIT:video:וידג׳ט הסרטון זמין במסלול מקצועי ומעלה.'
        using errcode = 'check_violation';
    end if;
    raise exception 'PLAN_LIMIT:video:המסלול הנוכחי מאפשר עד % סרטונים.', lim.max_videos
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists cards_enforce_video_limit on public.cards;
create trigger cards_enforce_video_limit
  before insert or update on public.cards
  for each row execute function public.enforce_video_limit();

grant update (videos) on public.cards to authenticated;
