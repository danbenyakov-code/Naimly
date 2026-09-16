-- שחזור שדות טופס הפניות (QA-008 / QA-013).
--
-- סיבת השורש: ברירת המחדל של העמודה היא '[]'::jsonb, והקוד נפל לברירת
-- מחדל רק כאשר הערך **אינו מערך**. מערך ריק הוא מערך — ולכן כל כרטיס
-- שנשמר בלי שדות מפורשים קיבל טופס עם תיבת פרטיות וכפתור שליחה בלבד,
-- בלי שום שדה למלא.
--
-- הכשל היה שקט: אין שגיאה ואין לוג, כי .map() על מערך ריק פשוט אינו
-- מרנדר דבר. הקוד תוקן בנפרד; כאן מתוקנים הנתונים הקיימים.
--
-- ברירת המחדל בעמודה משתנה גם היא, כדי ששורה עתידית שתיכתב בלי השדה
-- לא תיווצר שבורה מלכתחילה.
--
-- Rollback:
--   alter table public.cards alter column contact_form_fields set default '[]'::jsonb;
--   (הנתונים שמולאו נשארים — מחיקתם הייתה משחזרת את התקלה)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ברירת מחדל שאינה שוברת
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.cards alter column contact_form_fields set default
  '[{"id":"name","label":"שם מלא","type":"text","required":true,"enabled":true,"placeholder":""},
    {"id":"phone","label":"טלפון","type":"tel","required":true,"enabled":true,"placeholder":"050-0000000"},
    {"id":"email","label":"אימייל","type":"email","required":false,"enabled":true,"placeholder":"name@example.com"},
    {"id":"message","label":"במה נוכל לעזור?","type":"textarea","required":true,"enabled":true,"placeholder":""}]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. מילוי כרטיסים קיימים שנשארו בלי שדות
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * רק שורות ריקות או שאינן מערך. כרטיס שבו בעל העסק בחר שדות משלו
 * אינו נוגע — דריסת בחירה מודעת גרועה מהתקלה עצמה.
 */
update public.cards
set contact_form_fields =
  '[{"id":"name","label":"שם מלא","type":"text","required":true,"enabled":true,"placeholder":""},
    {"id":"phone","label":"טלפון","type":"tel","required":true,"enabled":true,"placeholder":"050-0000000"},
    {"id":"email","label":"אימייל","type":"email","required":false,"enabled":true,"placeholder":"name@example.com"},
    {"id":"message","label":"במה נוכל לעזור?","type":"textarea","required":true,"enabled":true,"placeholder":""}]'::jsonb,
    updated_at = now()
where contact_form_fields is null
   or jsonb_typeof(contact_form_fields) <> 'array'
   or jsonb_array_length(contact_form_fields) = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. חסימת פרסום של כרטיס עם טופס לא שמיש
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * טופס עם תיבת סימון בלבד אינו טופס פניות — אי אפשר להשאיר בו פרטים.
 * האכיפה במסד ולא רק בקוד: בקשה ישירה ל-API הייתה עוקפת בדיקה בממשק.
 */
create or replace function public.enforce_contact_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  usable integer;
begin
  if not new.is_published then
    return new;
  end if;

  select count(*) into usable
  from jsonb_array_elements(coalesce(new.contact_form_fields, '[]'::jsonb)) as field
  where coalesce((field ->> 'enabled')::boolean, true) is true
    and coalesce(field ->> 'type', 'text') <> 'checkbox'
    and length(trim(coalesce(field ->> 'label', ''))) > 0;

  if usable = 0 then
    raise exception 'PLAN_LIMIT:contactForm:טופס הפניות אינו כולל שדה למילוי. יש להציג לפחות שדה אחד כדי לפרסם.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists cards_enforce_contact_form on public.cards;
create trigger cards_enforce_contact_form
  before insert or update on public.cards
  for each row execute function public.enforce_contact_form();
