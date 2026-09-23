-- מיגרציה 029 שינתה את ה-check constraint על payment_requests.status
-- לערכים החדשים, אבל לא עדכנה את ברירת המחדל של העמודה — היא נשארה
-- 'pending', ערך שכבר לא חוקי לפי ה-constraint החדש. כל insert בלי
-- ציון status מפורש (כמו הבדיקה ב-tests/rls.test.mts) נכשל בשקט.
--
-- קוד האפליקציה עצמו לא נפגע — /api/payments/request תמיד מציין
-- status: "pending_admin_review" במפורש — אבל זו תקלה אמיתית: ברירת
-- מחדל שמפרה את ה-constraint של העמודה שלה היא סתירה בתוך הסכימה
-- עצמה, לא רק תיאורטית.
--
-- Rollback:
--   alter table public.payment_requests alter column status set default 'pending';

alter table public.payment_requests alter column status set default 'pending_admin_review';
