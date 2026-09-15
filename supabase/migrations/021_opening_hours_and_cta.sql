-- שעות פעילות מובנות ו-CTA ראשי לבחירה.
--
-- שעות: עד כה נשמרו כטקסט חופשי, ולכן אי אפשר היה לגזור מהן דבר. התג
-- "זמין לפניות" בכרטיס הוצג תמיד — גם בשבת בחצות. הטקסט החופשי נשאר
-- בעמודה שלו כגיבוי לכרטיסים ותיקים ואינו נמחק.
--
-- CTA: הכפתור הראשי היה קשיח ל-WhatsApp, ובעל כרטיס שרצה "התקשרו" או
-- "השאירו פרטים" לא יכול היה לבחור (BENCH-003).
--
-- ברירות המחדל משחזרות את ההתנהגות הקיימת בדיוק: מערך ריק פירושו שאין
-- שעות מוגדרות ולכן לא יוצג סטטוס, ו-CTA מסוג whatsapp הוא מה שהיה.
--
-- Rollback:
--   alter table public.cards drop column if exists opening_hours;
--   alter table public.cards drop column if exists primary_cta;

alter table public.cards
  add column if not exists opening_hours jsonb not null default '[]'::jsonb;

alter table public.cards
  add column if not exists primary_cta jsonb not null
  default '{"type":"whatsapp","label":"","value":""}'::jsonb;

comment on column public.cards.opening_hours is
  'שעות פעילות מובנות: [{day:0-6, closed:boolean, open:"HH:MM", close:"HH:MM"}]. ריק = לא הוגדרו, ואין להציג סטטוס.';
comment on column public.cards.primary_cta is
  'הכפתור הראשי: {type, label, value}. type אחד מ-whatsapp|phone|lead|meeting.';

grant update (opening_hours, primary_cta) on public.cards to authenticated;
