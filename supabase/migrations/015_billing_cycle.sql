-- מחזור החיוב של בקשת התשלום: חודשי או שנתי.
--
-- REQ-010: המתג במחירון אינו שווה דבר אם מה שנרשם בפועל הוא תמיד חיוב
-- חודשי. הסכום שנגבה, מספר החודשים שמופעלים ומה שהלקוח ראה במסך חייבים
-- להיות אותו דבר — ולכן מחזור החיוב נשמר ברשומה ולא רק בכתובת ה-URL.
--
-- ברירת המחדל 'monthly' שומרת על בקשות קיימות: רשומה שנוצרה לפני
-- המיגרציה אכן הייתה חיוב חודשי.
--
-- Rollback:
--   alter table public.payment_requests drop column if exists billing_cycle;

alter table public.payment_requests
  add column if not exists billing_cycle text not null default 'monthly'
  check (billing_cycle in ('monthly', 'annual'));

comment on column public.payment_requests.billing_cycle is
  'monthly = חיוב חודשי; annual = תשלום מראש ל-12 חודשים. קובע את amount ואת מספר החודשים שמופעלים באישור.';
