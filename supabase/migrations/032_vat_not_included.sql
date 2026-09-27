-- המחירים אינם כוללים מע״מ (החלטת בעל המערכת, 2026-09-27 — docs/qa/DECISIONS.md).
--
-- הקוד שומר vat_included=false בכל בקשה חדשה; כאן רק מיישרים את ברירת
-- המחדל של העמודה, כדי ש-insert שלא מציין את השדה לא יתעד את ההפך.
-- בקשות קיימות לא משתנות: זה snapshot של מה שהוצג ללקוח ברגע ההזמנה.
--
-- Rollback:
--   alter table public.payment_requests alter column vat_included set default true;

alter table public.payment_requests alter column vat_included set default false;
