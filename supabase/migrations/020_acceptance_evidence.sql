-- השלמת תיעוד ההסכמה (REQ-012).
--
-- הרשומה החזיקה user_id, גרסה, מסמכים, IP, דפדפן ומועד — אך לא את
-- המסלול שאליו התייחסה ההסכמה ולא מזהה פעולה שאפשר לצטט. תנאי הקבלה
-- דורשים את שניהם: בלי plan_id אי אפשר להוכיח על מה בדיוק הוסכם, ובלי
-- מזהה אי אפשר להפנות לרשומה מסוימת בפנייה או בהליך.
--
-- Rollback:
--   alter table public.legal_acceptances drop column if exists plan_id;
--   alter table public.legal_acceptances drop column if exists reference;

alter table public.legal_acceptances add column if not exists plan_id text;

/*
 * מזהה קצר לציטוט. נגזר מ-id ולכן ייחודי, אך קריא וניתן להכתבה
 * בטלפון — בניגוד ל-UUID מלא.
 */
alter table public.legal_acceptances
  add column if not exists reference text generated always as (upper(substring(id::text, 1, 8))) stored;

comment on column public.legal_acceptances.plan_id is
  'המסלול שהיה בתוקף או שנבחר במועד ההסכמה. null ברשומות שנוצרו לפני המיגרציה.';
comment on column public.legal_acceptances.reference is
  'מזהה קצר לציטוט בפניות ובהליכים. נגזר מה-id.';

-- ─────────────────────────────────────────────────────────────────────────────
-- הפונקציות מקבלות את המסלול
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.record_legal_acceptance(uuid, text, text, text, text);

create or replace function public.record_legal_acceptance(
  target_user uuid,
  acceptance_context text,
  accepted_version text,
  client_ip text default null,
  client_agent text default null,
  target_plan text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_reference text;
begin
  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent, plan_id)
  values (
    target_user, acceptance_context, accepted_version,
    array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
    nullif(client_ip, '')::inet, client_agent, target_plan
  )
  returning reference into new_reference;

  update public.profiles
  set terms_accepted_at = now(), terms_version = accepted_version, updated_at = now()
  where id = target_user;

  return new_reference;
end;
$$;

revoke execute on function public.record_legal_acceptance(uuid, text, text, text, text, text) from public, anon, authenticated;

drop function if exists public.accept_current_terms(text, text, text);

create or replace function public.accept_current_terms(
  accepted_version text,
  client_ip text default null,
  client_agent text default null
)
returns table (accepted_at timestamptz, reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_plan text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED:יש להתחבר כדי לאשר את המסמכים.'
      using errcode = 'insufficient_privilege';
  end if;

  if accepted_version is null or length(trim(accepted_version)) = 0 then
    raise exception 'TERMS_REQUIRED:יש לאשר את תנאי השימוש כדי להמשיך.'
      using errcode = 'check_violation';
  end if;

  current_plan := public.effective_plan(uid);

  return query
  with inserted as (
    insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent, plan_id)
    values (
      uid, 're_accept', accepted_version,
      array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
      nullif(client_ip, '')::inet, client_agent, current_plan
    )
    returning legal_acceptances.accepted_at, legal_acceptances.reference
  ), touched as (
    update public.profiles
    set terms_accepted_at = now(), terms_version = accepted_version, updated_at = now()
    where id = uid
    returning 1
  )
  select inserted.accepted_at, inserted.reference from inserted, touched;
end;
$$;

revoke execute on function public.accept_current_terms(text, text, text) from public, anon;
grant execute on function public.accept_current_terms(text, text, text) to authenticated;

-- בחירת ההתנסות רושמת גם היא את המסלול.
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

  if accepted_version is null or length(trim(accepted_version)) = 0 then
    raise exception 'TERMS_REQUIRED:יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך.'
      using errcode = 'check_violation';
  end if;

  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent, plan_id)
  values (
    uid, 'plan', accepted_version,
    array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
    nullif(client_ip, '')::inet, client_agent, 'trial'
  );

  update public.profiles
  set terms_accepted_at = now(), terms_version = accepted_version, updated_at = now()
  where id = uid;

  select s.plan_selected_at into already from public.subscriptions s where s.user_id = uid;

  if already is not null then
    select s.trial_ends_at into ends_at from public.subscriptions s where s.user_id = uid;
    return ends_at;
  end if;

  -- REQ-014: התנסות אחת לכל כתובת דוא״ל.
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
