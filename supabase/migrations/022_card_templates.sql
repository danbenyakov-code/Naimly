-- הרחבת רשימת התבניות המותרות.
--
-- האילוץ הוגדר בעת יצירת הטבלה עם שלוש תבניות, והספרייה גדלה לשש.
-- המסד דחה את התבניות החדשות — וזו ההתנהגות הנכונה: הוא השכבה שמונעת
-- ערך שלא הוגדר, גם כשהקוד חושב אחרת.
--
-- הרשימה כאן חייבת להישאר תואמת ל-cardTemplates ב-src/lib/card-templates.ts.
-- בדיקת יחידה משווה ביניהן.
--
-- Rollback:
--   alter table public.cards drop constraint if exists cards_template_check;
--   alter table public.cards add constraint cards_template_check
--     check (template in ('spotlight', 'clean', 'bold'));

alter table public.cards drop constraint if exists cards_template_check;

alter table public.cards add constraint cards_template_check
  check (template in ('spotlight', 'clean', 'bold', 'services', 'portfolio', 'local'));
