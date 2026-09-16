-- מעקב מסירת התראת הליד (QA-033).
--
-- עד כה השליחה הייתה "שגר ושכח": `sendLeadNotification(...).catch(() => null)`.
-- זו ההתנהגות הנכונה מבחינת הליד — פנייה נשמרת גם כשהמייל נכשל — אבל
-- היא הותירה את בעל הכרטיס בלי שום דרך לדעת שההתראה לא הגיעה, ואותנו
-- בלי דרך לאבחן.
--
-- הסיבה השורשית של QA-033 הייתה אחרת לגמרי (שדה המלכודת נקרא `website`,
-- הדפדפן מילא אותו, והפנייה נדחתה בשקט — ראו מיגרציה 025 והקומיט שלה).
-- הסטטוס כאן נועד לכך שתקלת מסירה הבאה לא תהיה בלתי נראית.
--
-- Rollback:
--   alter table public.leads drop column if exists notification_status;
--   alter table public.leads drop column if exists notification_error;
--   alter table public.leads drop column if exists notification_at;

alter table public.leads
  add column if not exists notification_status text not null default 'pending'
  check (notification_status in ('pending', 'sent', 'failed', 'skipped'));

alter table public.leads add column if not exists notification_error text;
alter table public.leads add column if not exists notification_at timestamptz;

comment on column public.leads.notification_status is
  'pending = טרם נשלח; sent = נמסר לספק; failed = הספק דחה; skipped = ההתראות כבויות בכרטיס.';
comment on column public.leads.notification_error is
  'סיבת הכשל, לאבחון. לעולם ללא תוכן הפנייה עצמה.';

create index if not exists leads_notification_pending_idx
  on public.leads (notification_status, created_at desc)
  where notification_status in ('pending', 'failed');
