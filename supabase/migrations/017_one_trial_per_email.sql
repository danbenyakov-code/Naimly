-- התנסות אחת לכל כתובת דוא״ל (REQ-014).
--
-- עד כה אפשר היה לקבל התנסות נוספת פשוט על ידי פתיחת חשבון חדש. סעיף 3
-- לתנאי השימוש מתחייב ל"חשבון אחד לכל כתובת דוא״ל", והתחייבות שאינה
-- נאכפת במסד היא הצהרה בלבד.
--
-- האכיפה היא ברמת המסד ולא בקוד: unique index על הכתובת המנורמלת מונע
-- את הכפילות גם בבקשות מקבילות, שבהן בדיקה ואז כתיבה בקוד היו שתיהן
-- עוברות.
--
-- Rollback:
--   drop table if exists public.trial_email_claims;
--   drop function if exists public.normalize_trial_email(text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. נרמול הכתובת
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * בלי נרמול, ההגבלה נעקפת בשנייה: a+1@gmail.com ו-a.b@gmail.com מגיעות
 * לאותה תיבה ממש. לכן מוסר כל מה שאחרי + בחלק המקומי, ובגוגל מוסרות גם
 * הנקודות — זו התנהגות הניתוב האמיתית של הספק, לא ניחוש.
 */
create or replace function public.normalize_trial_email(raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := lower(trim(coalesce(raw, '')));
  local_part text;
  domain_part text;
begin
  if cleaned = '' or position('@' in cleaned) = 0 then
    return cleaned;
  end if;

  local_part := split_part(cleaned, '@', 1);
  domain_part := split_part(cleaned, '@', 2);

  -- כתובת משנה (sub-addressing): הכול אחרי + מנותב לאותה תיבה.
  local_part := split_part(local_part, '+', 1);

  if domain_part in ('gmail.com', 'googlemail.com') then
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
  end if;

  if local_part = '' then
    return cleaned;
  end if;

  return local_part || '@' || domain_part;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. רישום המימוש
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trial_email_claims (
  normalized_email text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_email text not null default '',
  claimed_at timestamptz not null default now()
);

create index if not exists trial_email_claims_user_idx on public.trial_email_claims(user_id);

alter table public.trial_email_claims enable row level security;

-- אין מדיניות קריאה ללקוחות: הטבלה מגלה אילו כתובות קיימות במערכת.
-- הגישה עוברת דרך הפונקציות security definer ודרך מפתח השירות בלבד.
drop policy if exists "trial_email_claims_admin_read" on public.trial_email_claims;
create policy "trial_email_claims_admin_read" on public.trial_email_claims
  for select to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. אכיפה בתוך בחירת ההתנסות
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.select_trial_plan(
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
  ends_at timestamptz;
  already timestamptz;
  user_email text;
  normalized text;
  claimed_by uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED:יש להתחבר כדי לבחור מסלול.' using errcode = 'insufficient_privilege';
  end if;

  -- אישור התקנון אינו קישוט. בלעדיו אין בחירה, ולכן אין גישה.
  if accepted_version is null or length(trim(accepted_version)) = 0 then
    raise exception 'TERMS_REQUIRED:יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך.'
      using errcode = 'check_violation';
  end if;

  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent)
  values (
    uid, 'plan', accepted_version,
    array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
    nullif(client_ip, '')::inet, client_agent
  );

  update public.profiles
  set terms_accepted_at = now(), terms_version = accepted_version, updated_at = now()
  where id = uid;

  select s.plan_selected_at into already from public.subscriptions s where s.user_id = uid;

  -- בחירה חוזרת אינה מאפסת את ההתנסות.
  if already is not null then
    select s.trial_ends_at into ends_at from public.subscriptions s where s.user_id = uid;
    return ends_at;
  end if;

  /*
   * REQ-014: ההתנסות ניתנת פעם אחת לכל כתובת דוא״ל. הבדיקה מתבצעת כאן,
   * אחרי תיעוד ההסכמה — כדי שגם ניסיון שנדחה יישאר מתועד — ולפני
   * הפעלת ההתנסות עצמה.
   */
  select u.email into user_email from auth.users u where u.id = uid;
  normalized := public.normalize_trial_email(user_email);

  if normalized <> '' then
    select c.user_id into claimed_by
    from public.trial_email_claims c
    where c.normalized_email = normalized;

    if claimed_by is not null and claimed_by <> uid then
      raise exception 'TRIAL_ALREADY_USED:כתובת האימייל הזו כבר מימשה תקופת התנסות. אפשר להמשיך במסלול בתשלום.'
        using errcode = 'unique_violation';
    end if;

    insert into public.trial_email_claims (normalized_email, user_id, original_email)
    values (normalized, uid, coalesce(user_email, ''))
    on conflict (normalized_email) do nothing;
  end if;

  ends_at := now() + interval '14 days';

  update public.subscriptions
  set plan_id = 'trial',
      status = 'trialing',
      provider = 'trial',
      trial_pending = false,
      plan_selected_at = now(),
      trial_started_at = now(),
      trial_ends_at = ends_at,
      current_period_end = ends_at,
      updated_at = now()
  where user_id = uid;

  update public.profiles set plan_id = 'trial', updated_at = now() where id = uid;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (uid, 'trial.start', 'user', uid::text,
          jsonb_build_object('trigger', 'plan_selection', 'ends_at', ends_at, 'terms_version', accepted_version));

  return ends_at;
end;
$$;

revoke execute on function public.select_trial_plan(text, text, text) from public, anon;
grant execute on function public.select_trial_plan(text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. רישום למפרע של מי שכבר מימש
-- ─────────────────────────────────────────────────────────────────────────────
/*
 * בלי זה, כל לקוח קיים היה יכול לפתוח חשבון נוסף באותה כתובת ולקבל
 * התנסות שנייה — ההגבלה הייתה חלה רק על מי שנרשם מהיום.
 */
insert into public.trial_email_claims (normalized_email, user_id, original_email, claimed_at)
select distinct on (public.normalize_trial_email(u.email))
       public.normalize_trial_email(u.email), s.user_id, u.email, coalesce(s.trial_started_at, s.plan_selected_at, now())
from public.subscriptions s
join auth.users u on u.id = s.user_id
where s.trial_started_at is not null
  and public.normalize_trial_email(u.email) <> ''
order by public.normalize_trial_email(u.email), coalesce(s.trial_started_at, s.plan_selected_at) asc
on conflict (normalized_email) do nothing;
