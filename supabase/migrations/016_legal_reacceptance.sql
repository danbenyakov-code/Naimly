-- אישור מחדש של המסמכים המשפטיים לאחר עדכון גרסה.
--
-- עד כה ההסכמה תועדה אך לא נאכפה: משתמש שאישר נוסח ישן המשיך לעבוד
-- כרגיל גם אחרי שהנוסח השתנה מהותית. הסכמה לנוסח קודם אינה הסכמה
-- לנוסח הנוכחי, ולכן נדרש מסלול שבו המשתמש מאשר בעצמו את הגרסה החדשה.
--
-- record_legal_acceptance נשללה מ-authenticated בכוונה (מיגרציה 011), כי
-- היא מקבלת target_user ומאפשרת לרשום הסכמה בשם משתמש אחר. הפונקציה
-- כאן פועלת על auth.uid() בלבד, ולכן בטוחה לחשיפה ללקוח.
--
-- Rollback:
--   drop function if exists public.accept_current_terms(text, text, text);

create or replace function public.accept_current_terms(
  accepted_version text,
  client_ip text default null,
  client_agent text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  accepted timestamptz := now();
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED:יש להתחבר כדי לאשר את המסמכים.'
      using errcode = 'insufficient_privilege';
  end if;

  if accepted_version is null or length(trim(accepted_version)) = 0 then
    raise exception 'TERMS_REQUIRED:יש לאשר את תנאי השימוש כדי להמשיך.'
      using errcode = 'check_violation';
  end if;

  -- append-only: כל אישור נשמר כשורה נוספת ואינו דורס את הקודם, כדי
  -- שתישמר שרשרת ראיות לכל גרסה בנפרד.
  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent)
  values (
    uid, 're_accept', accepted_version,
    array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
    nullif(client_ip, '')::inet, client_agent
  );

  update public.profiles
  set terms_accepted_at = accepted, terms_version = accepted_version, updated_at = now()
  where id = uid;

  return accepted;
end;
$$;

revoke execute on function public.accept_current_terms(text, text, text) from public, anon;
grant execute on function public.accept_current_terms(text, text, text) to authenticated;

-- הלקוח קורא את גרסת ההסכמה שלו כדי לדעת אם נדרש אישור מחדש.
grant select (id, full_name, email, phone, role, plan_id, onboarding_seen_at, terms_accepted_at, terms_version)
  on public.profiles to authenticated;
