-- מיקום הלוגו ותיאור לקבצים להורדה.
--
-- REQ-009: הלוגו הוצג תמיד באותו מקום. עסקים עם לוגו רחב או שקוף
-- נראים טוב יותר במרכז, ולא הייתה דרך לבחור.
--
-- QA-028: רכיב "קבצים" היה מופעל ונכלל ברשימת יכולות המסלול, אך לא
-- היה שום ממשק להעלות אליו — כלומר הבטחה שלא ניתן לממש. הטיפוס קיים
-- כבר, וכאן נוסף רק התיאור שמוצג למבקר ליד כפתור ההורדה.
--
-- Rollback:
--   alter table public.cards drop column if exists logo_position;

alter table public.cards add column if not exists logo_position text not null default 'right'
  check (logo_position in ('right', 'center', 'left'));

comment on column public.cards.logo_position is
  'מיקום הלוגו בראש הכרטיס. ברירת המחדל ימין, בהתאם לכיוון הקריאה בעברית.';
