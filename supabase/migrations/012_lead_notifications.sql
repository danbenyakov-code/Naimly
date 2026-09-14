-- יעד התראות לידים, ניתן להגדרה ולכיבוי.
--
-- QA-033: ההתראה נשלחה תמיד לכתובת הדוא״ל של בעל החשבון, בלי שהיא
-- מוצגת בשום מקום ובלי אפשרות לשנות או לכבות. בעל עסק שמנהל פניות
-- בתיבה אחרת לא יכול היה לדעת לאן הן נשלחות, ולא יכול היה להפנות אותן.
--
-- Rollback:
--   alter table public.cards
--     drop column if exists lead_notification_email,
--     drop column if exists lead_notifications_enabled,
--     drop column if exists lead_notification_verified_at;

alter table public.cards add column if not exists lead_notification_email text not null default '';
alter table public.cards add column if not exists lead_notifications_enabled boolean not null default true;
alter table public.cards add column if not exists lead_notification_verified_at timestamptz;

comment on column public.cards.lead_notification_email is
  'יעד התראות הלידים. ריק = כתובת בעל החשבון, כברירת מחדל תואמת-אחורה.';

comment on column public.cards.lead_notification_verified_at is
  'מתי נשלח בהצלחה מייל בדיקה ליעד. null = היעד טרם אומת.';

-- הכתיבה עוברת דרך ה-API שממילא מאמת בעלות; נוספת הרשאת עמודה מפורשת
-- כדי שבעל הכרטיס יוכל לעדכן את היעד גם דרך הלקוח.
grant update (lead_notification_email, lead_notifications_enabled, updated_at) on public.cards to authenticated;
