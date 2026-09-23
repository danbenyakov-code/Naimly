-- תהליך רכישה ותשלום ידני מסודר, עד לחיבור עתידי לספק סליקה.
--
-- מרחיב את payment_requests הקיימת (ממיגרציה 004) במקום ליצור טבלה
-- מקבילה: יש לה כבר RLS נכון, אינדקסים, ו-60% מהשדות הנדרשים. יצירת
-- טבלה שנייה הייתה מייצרת שני מקורות אמת לאותו דבר.
--
-- הזרימה הישנה: לקוח פותח בקשה ומקבל הוראות תשלום מיידיות בוואטסאפ,
-- מנהל מאשר בפעולה אחת שגם מפעילה את המנוי. הזרימה החדשה מפרידה בין
-- "בקשה התקבלה" ל"מנהל שלח קישור תשלום" ל"תשלום אומת" ל"הופעל" —
-- כל מעבר נשמר, וכל מעבר עובר ולידציה בשרת (טריגר, לא רק קוד).
--
-- Rollback מלא בסוף הקובץ.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. שדות ה-snapshot — פרטי ההזמנה כפי שהיו ברגע היצירה, לא נגזרים
--    מחדש מהמחירון בכל תצוגה. שינוי עתידי במחיר לא ישנה בקשה פתוחה.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payment_requests add column if not exists plan_name_snapshot text not null default '';
alter table public.payment_requests add column if not exists price_before_discount numeric(10,2);
alter table public.payment_requests add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.payment_requests add column if not exists currency text not null default 'ILS';
alter table public.payment_requests add column if not exists vat_included boolean not null default true;
alter table public.payment_requests add column if not exists cards_included integer not null default 1;
alter table public.payment_requests add column if not exists features_snapshot jsonb not null default '[]'::jsonb;
alter table public.payment_requests add column if not exists pricing_version text not null default '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. תיעוד משפטי, קישור תשלום, חשבונית והערות.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payment_requests add column if not exists terms_version text not null default '';
alter table public.payment_requests add column if not exists legal_reference text;
alter table public.payment_requests add column if not exists terms_accepted_at timestamptz;

alter table public.payment_requests add column if not exists payment_link text;
alter table public.payment_requests add column if not exists payment_link_expires_at timestamptz;
alter table public.payment_requests add column if not exists payment_reference text;

alter table public.payment_requests add column if not exists invoice_issued boolean not null default false;
alter table public.payment_requests add column if not exists invoice_reference text;
alter table public.payment_requests add column if not exists invoice_issued_at timestamptz;
alter table public.payment_requests add column if not exists invoice_note text not null default '';
alter table public.payment_requests add column if not exists invoice_sent_to_customer boolean not null default false;

alter table public.payment_requests add column if not exists customer_notes text not null default '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. חותמות זמן לכל שלב — מאפשרות לדעת כמה זמן כל שלב לוקח בפועל,
--    ולזהות עסקאות שנתקעו.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payment_requests add column if not exists payment_link_sent_at timestamptz;
alter table public.payment_requests add column if not exists customer_reported_paid_at timestamptz;
alter table public.payment_requests add column if not exists payment_confirmed_at timestamptz;
alter table public.payment_requests add column if not exists activated_at timestamptz;
alter table public.payment_requests add column if not exists rejected_at timestamptz;
alter table public.payment_requests add column if not exists cancelled_at timestamptz;
alter table public.payment_requests add column if not exists refunded_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Card ID — לא כל בקשה קשורה לכרטיס ספציפי (למשל בחירת מסלול
--    ראשונה), אבל "כרטיס נוסף" כן.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payment_requests add column if not exists card_id uuid references public.cards(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. הרחבת הסטטוסים. מיפוי הנתונים הקיימים קודם, לפני שה-constraint
--    החדש נאכף — אחרת שורות קיימות ייתקעו מחוץ לטווח החוקי.
-- ─────────────────────────────────────────────────────────────────────────────
update public.payment_requests set status = 'pending_admin_review' where status = 'pending';
update public.payment_requests set status = 'active', activated_at = coalesce(activated_at, reviewed_at, updated_at) where status = 'approved';
update public.payment_requests set status = 'cancelled' where status = 'canceled';
-- 'rejected' כבר תואם, נשאר כפי שהוא.
update public.payment_requests set rejected_at = coalesce(rejected_at, reviewed_at, updated_at) where status = 'rejected';

alter table public.payment_requests drop constraint if exists payment_requests_status_check;
alter table public.payment_requests add constraint payment_requests_status_check
  check (status in (
    'pending_admin_review', 'awaiting_payment_link', 'payment_link_sent',
    'customer_reported_paid', 'payment_verification', 'paid_pending_activation',
    'active', 'rejected', 'cancelled', 'expired', 'refunded'
  ));

create index if not exists payment_requests_card_idx on public.payment_requests(card_id) where card_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. State machine באכיפת שרת — לא רק בקוד ה-API.
--
--    זו בדיוק אותה פילוסופיה כמו enforce_plan_limits: שלוש שכבות
--    (UI → API → Postgres), וכל אחת חייבת להסכים. קריאת RPC ישירה
--    (למשל בעתיד מספק סליקה אחר) לא יכולה לעקוף את המעברים החוקיים.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.validate_payment_request_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'pending_admin_review'   then new.status in ('awaiting_payment_link', 'rejected', 'cancelled')
    when 'awaiting_payment_link'  then new.status in ('payment_link_sent', 'rejected', 'cancelled')
    when 'payment_link_sent'      then new.status in ('customer_reported_paid', 'expired', 'cancelled')
    when 'customer_reported_paid' then new.status in ('payment_verification', 'cancelled')
    when 'payment_verification'   then new.status in ('paid_pending_activation', 'payment_link_sent', 'rejected', 'cancelled')
    when 'paid_pending_activation' then new.status in ('active', 'cancelled')
    when 'active'                 then new.status in ('refunded')
    when 'expired'                then new.status in ('awaiting_payment_link', 'cancelled')
    -- rejected / cancelled / refunded — סופיים, אין מעבר החוצה.
    else false
  end;

  if not allowed then
    raise exception 'STATUS_TRANSITION:מעבר סטטוס לא חוקי: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- הפעלה דורשת payment_confirmed_at — אי אפשר לדלג ישירות מבדיקה להפעלה.
  if new.status = 'active' and new.payment_confirmed_at is null then
    raise exception 'STATUS_TRANSITION:אי אפשר להפעיל בלי אימות תשלום קודם'
      using errcode = 'check_violation';
  end if;

  -- הפעלה דורשת מנהל מזוהה שביצע את הבדיקה.
  if new.status = 'active' and new.reviewed_by is null then
    raise exception 'STATUS_TRANSITION:אי אפשר להפעיל בלי מנהל מזוהה שאישר'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_requests_validate_transition on public.payment_requests;
create trigger payment_requests_validate_transition
  before update on public.payment_requests
  for each row execute function public.validate_payment_request_transition();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. הפעלה — עוטפת activate_subscription הקיימת, אבל מוסיפה Idempotency
--    ואת עדכון הבקשה עצמה **באותה טרנזקציה**. קריאה כפולה על בקשה
--    שכבר active אינה כשל ואינה יוצרת הפעלה כפולה — רק מדווחת שכבר בוצע.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.activate_purchase_request(
  request_id uuid,
  actor uuid
)
returns table (already_active boolean, plan_id text, months integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  req record;
  computed_months integer;
begin
  select * into req from public.payment_requests where id = request_id for update;
  if not found then
    raise exception 'לא נמצאה בקשה % ', request_id;
  end if;

  if req.status = 'active' then
    return query select true, req.plan_id, 0;
    return;
  end if;

  if req.status <> 'paid_pending_activation' then
    raise exception 'STATUS_TRANSITION:אפשר להפעיל רק בקשה שממתינה להפעלה (paid_pending_activation), הבקשה הזו במצב %', req.status
      using errcode = 'check_violation';
  end if;

  computed_months := case when req.billing_cycle = 'annual' then 12 else 1 end;

  if req.plan_id = 'extra_card' then
    perform public.grant_extra_card(req.user_id, 1, actor);
  else
    perform public.activate_subscription(req.user_id, req.plan_id, computed_months, actor);
  end if;

  update public.payment_requests
  set status = 'active',
      reviewed_by = actor,
      activated_at = now(),
      updated_at = now()
  where id = request_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'payment_request.activate', 'payment_request', request_id::text,
          jsonb_build_object('plan', req.plan_id, 'months', computed_months, 'reference', req.reference));

  return query select false, req.plan_id, computed_months;
end;
$$;

revoke execute on function public.activate_purchase_request(uuid, uuid) from public, anon, authenticated;

comment on function public.activate_purchase_request(uuid, uuid) is
  'Idempotent: קריאה שנייה על בקשה שכבר active מחזירה already_active=true בלי לגעת בהרשאות שוב.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. אימות תשלום — שני צעדים אטומיים באותה קריאה (customer_reported_paid
--    -> payment_verification -> paid_pending_activation), כל אחד עובר
--    בטריגר בנפרד. זו הפעולה שקובעת payment_confirmed_at — התנאי היחיד
--    שמאפשר בהמשך להפעיל. הפעלה עצמה היא לחיצה נפרדת ומפורשת
--    (activate_purchase_request), לא חלק מהפונקציה הזו.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.verify_purchase_payment(
  request_id uuid,
  actor uuid,
  confirmed_reference text default null,
  admin_note_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req record;
begin
  select * into req from public.payment_requests where id = request_id for update;
  if not found then
    raise exception 'לא נמצאה בקשה %', request_id;
  end if;

  if req.status not in ('customer_reported_paid', 'payment_verification') then
    raise exception 'STATUS_TRANSITION:אפשר לאמת תשלום רק כשהלקוח דיווח על תשלום, הבקשה במצב %', req.status
      using errcode = 'check_violation';
  end if;

  if req.status = 'customer_reported_paid' then
    update public.payment_requests set status = 'payment_verification', updated_at = now() where id = request_id;
  end if;

  update public.payment_requests
  set status = 'paid_pending_activation',
      payment_confirmed_at = now(),
      payment_reference = coalesce(confirmed_reference, req.payment_reference),
      admin_note = coalesce(admin_note_text, req.admin_note),
      reviewed_by = actor,
      reviewed_at = now(),
      updated_at = now()
  where id = request_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'payment_request.verify_payment', 'payment_request', request_id::text,
          jsonb_build_object('reference', req.reference, 'payment_reference', confirmed_reference));
end;
$$;

revoke execute on function public.verify_purchase_payment(uuid, uuid, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback:
--   drop trigger if exists payment_requests_validate_transition on public.payment_requests;
--   drop function if exists public.validate_payment_request_transition();
--   drop function if exists public.activate_purchase_request(uuid, uuid);
--   drop function if exists public.verify_purchase_payment(uuid, uuid, text, text);
--   alter table public.payment_requests drop constraint if exists payment_requests_status_check;
--   alter table public.payment_requests add constraint payment_requests_status_check
--     check (status in ('pending', 'approved', 'rejected', 'canceled'));
--   update public.payment_requests set status = 'pending' where status in
--     ('pending_admin_review','awaiting_payment_link','payment_link_sent','customer_reported_paid','payment_verification','paid_pending_activation','expired');
--   update public.payment_requests set status = 'approved' where status = 'active';
--   update public.payment_requests set status = 'canceled' where status in ('cancelled','refunded');
--   alter table public.payment_requests
--     drop column if exists plan_name_snapshot, drop column if exists price_before_discount,
--     drop column if exists discount_amount, drop column if exists currency,
--     drop column if exists vat_included, drop column if exists cards_included,
--     drop column if exists features_snapshot, drop column if exists pricing_version,
--     drop column if exists terms_version, drop column if exists legal_reference,
--     drop column if exists terms_accepted_at, drop column if exists payment_link,
--     drop column if exists payment_link_expires_at, drop column if exists payment_reference,
--     drop column if exists invoice_issued, drop column if exists invoice_reference,
--     drop column if exists invoice_issued_at, drop column if exists invoice_note,
--     drop column if exists invoice_sent_to_customer, drop column if exists customer_notes,
--     drop column if exists payment_link_sent_at, drop column if exists customer_reported_paid_at,
--     drop column if exists payment_confirmed_at, drop column if exists activated_at,
--     drop column if exists rejected_at, drop column if exists cancelled_at,
--     drop column if exists refunded_at, drop column if exists card_id;
