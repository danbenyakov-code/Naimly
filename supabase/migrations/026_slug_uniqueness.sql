-- ייחודיות כתובת הכרטיס, ללא תלות ברישיות (NEW-006).
--
-- `cards_slug_key` קיים ומונע כפילות מדויקת, אך הוא רגיש לרישיות:
-- 'My-Card' ו-'my-card' יכלו להתקיים יחד ולהצביע לאותו עמוד ציבורי.
-- הוולידציה בקוד אוסרת אותיות גדולות, אבל כתיבה ישירה למסד או שינוי
-- עתידי בוולידציה היו פותחים את הפער — ואכיפה שנשענת על שכבה אחת
-- אינה אכיפה.
--
-- האינדקס גם סוגר את ה-race condition: שתי בקשות מקבילות על אותה
-- כתובת — אחת תצליח והשנייה תיכשל ב-23505, שמתורגם להודעה ברורה.
--
-- Rollback:
--   drop index if exists cards_slug_lower_key;

/*
 * ניקוי לפני האינדקס: אם קיימות כתובות שנבדלות רק ברישיות, יצירת
 * האינדקס תיכשל. הבדיקה מדווחת ואינה מוחקת — מחיקת כרטיס של לקוח
 * בשם "ניקוי" אינה החלטה של מיגרציה.
 */
do $$
declare
  duplicates integer;
begin
  select count(*) into duplicates from (
    select lower(slug) from public.cards group by lower(slug) having count(*) > 1
  ) as dupes;

  if duplicates > 0 then
    raise exception 'נמצאו % כתובות שנבדלות רק ברישיות. יש לטפל בהן ידנית לפני המיגרציה.', duplicates;
  end if;
end;
$$;

create unique index if not exists cards_slug_lower_key on public.cards (lower(slug));

comment on index public.cards_slug_lower_key is
  'ייחודיות כתובת ללא תלות ברישיות. סוגר גם race condition בין שתי בקשות מקבילות.';
