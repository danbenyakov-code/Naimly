-- שפת הכרטיס הציבורי (QA-035 / REQ-025).
--
-- הכרטיס הוא נכס שיווקי שמוצג ללקוחות הקצה של בעל העסק, ולא כל עסק
-- פונה לקהל דובר עברית. השפה נשמרת ברמת הכרטיס ולא ברמת המשתמש, כי
-- מי שמנהל את המערכת בעברית עשוי לפרסם כרטיס באנגלית.
--
-- ברירת המחדל 'he' שומרת על כל הכרטיסים הקיימים כפי שהם.
--
-- Rollback:
--   alter table public.cards drop column if exists language;

alter table public.cards
  add column if not exists language text not null default 'he'
  check (language in ('he', 'en'));

comment on column public.cards.language is
  'שפת הכרטיס הציבורי: he (ימין-לשמאל) או en (שמאל-לימין). משפיעה על התוויות, ההודעות, כיוון הטקסט ותגי ה-SEO.';
