-- הפרדה בין מיילי שירות לדיוור שיווקי, והסכמה נפרדת ומתועדת לשיווק.
--
-- מיילי שירות (תזכורות על הניסיון, דוח שבועי על הכרטיס) הם חלק מהשירות:
-- פעילים כברירת מחדל, וניתנים לכיבוי בהגדרות.
--
-- דיוור שיווקי (עדכוני מוצר, הצעות ומבצעים) נשלח רק למי שבחר בו במפורש,
-- בתיבת סימון נפרדת שאינה חובה ואינה מסומנת מראש. הסכמה שניתנה כתנאי
-- לשירות חשופה לטענה שאינה הסכמה חופשית (סעיף 30א לחוק התקשורת,
-- ועמדת הרשות להגנת הפרטיות), ולכן היא אינה תנאי לשום דבר.
--
-- כל הסכמה נרשמת כראיה ב-legal_acceptances (context = 'marketing'):
-- גרסת הנוסח, חותמת זמן, IP ודפדפן, וגם ביומן הלקוח (marketing_consent).
--
-- Rollback:
--   alter table public.email_preferences drop column if exists marketing_consent_at,
--     drop column if exists marketing_consent_source;
--   alter table public.email_preferences alter column product_updates set default true,
--     alter column marketing set default true;
--   drop function if exists public.record_marketing_consent(uuid, text, text[], text, text, text);
--   (להחזיר את ה-check של legal_acceptances ושל user_events)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ראיית ההסכמה
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.legal_acceptances drop constraint if exists legal_acceptances_context_check;
alter table public.legal_acceptances add constraint legal_acceptances_context_check
  check (context in ('signup', 'plan', 're_accept', 'marketing'));

alter table public.email_preferences add column if not exists marketing_consent_at timestamptz;
alter table public.email_preferences add column if not exists marketing_consent_source text;
comment on column public.email_preferences.marketing_consent_at is
  'מתי ניתנה לאחרונה הסכמה מפורשת לדיוור שיווקי. null = לא ניתנה, ואין לשלוח שיווק.';

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (event_type in (
  'signed_up', 'email_verified', 'logged_in', 'app_visit', 'plan_selected',
  'card_created', 'card_first_edit', 'card_published', 'card_unpublished', 'card_deleted',
  'card_first_view', 'first_lead_received',
  'payment_requested', 'payment_completed', 'subscription_activated', 'trial_expired', 'subscription_expired',
  'email_sent', 'unsubscribed', 'marketing_consent'
));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. שיווק: כבוי עד שיש הסכמה. לקוחות קיימים לא נתנו הסכמה נפרדת.
--    הכיבוי כאן אינו "הסרה" של הלקוח, ולכן לא נרשם ביומן.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.email_preferences alter column product_updates set default false;
alter table public.email_preferences alter column marketing set default false;

alter table public.email_preferences disable trigger email_preferences_log_changes;
update public.email_preferences
set product_updates = false, marketing = false
where marketing_consent_at is null and (product_updates or marketing);
alter table public.email_preferences enable trigger email_preferences_log_changes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. רישום הסכמה: מפעיל את הקטגוריות שנבחרו, ושומר ראיה.
--    נקרא מהשרת בלבד (מסך הניסיון, אישור התקנון, הגדרות, קישור במייל).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_marketing_consent(
  target_user uuid,
  consent_source text,
  categories text[],
  accepted_version text,
  client_ip text default null,
  client_agent text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_reference text;
  wanted text[] := array(select unnest(categories) intersect select unnest(array['product_updates', 'marketing']));
begin
  if target_user is null or coalesce(array_length(wanted, 1), 0) = 0 then
    return null;
  end if;

  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent)
  values (target_user, 'marketing', coalesce(accepted_version, ''), array['terms', 'privacy'],
          nullif(client_ip, '')::inet, client_agent)
  returning reference into new_reference;

  insert into public.email_preferences (user_id) values (target_user) on conflict (user_id) do nothing;
  update public.email_preferences
  set product_updates = product_updates or 'product_updates' = any(wanted),
      marketing = marketing or 'marketing' = any(wanted),
      marketing_consent_at = now(),
      marketing_consent_source = consent_source
  where user_id = target_user;

  perform public.log_user_event(target_user, 'marketing_consent',
    jsonb_build_object('source', consent_source, 'categories', to_jsonb(wanted), 'reference', new_reference, 'version', accepted_version));

  return new_reference;
end;
$$;

revoke execute on function public.record_marketing_consent(uuid, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.record_marketing_consent(uuid, text, text[], text, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. אין עקיפה של הראיה: הלקוח מעדכן ישירות רק את מיילי השירות. שיווק
--    נדלק ונכבה רק דרך השרת, שמדליק אותו אך ורק עם record_marketing_consent.
-- ─────────────────────────────────────────────────────────────────────────────
revoke update on public.email_preferences from authenticated;
grant update (trial_reminders, weekly_report, updated_at) on public.email_preferences to authenticated;
