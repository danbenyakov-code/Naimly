-- תיעוד הסכמה למסמכים המשפטיים.
--
-- הסכמה שלא תועדה שווה להסכמה שלא ניתנה: בלי חותמת זמן, גרסה וכתובת IP
-- אין דרך להוכיח למה בדיוק הלקוח הסכים ומתי. הטבלה היא append-only —
-- כל אישור נשמר כשורה חדשה ולא דורס את הקודמת, כדי שתישמר שרשרת ראיות
-- גם אחרי עדכון גרסה.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'signup' = בפתיחת החשבון, 'plan' = בבחירת מסלול, 're_accept' = אחרי עדכון גרסה.
  context text not null check (context in ('signup', 'plan', 're_accept')),
  document_version text not null,
  documents text[] not null,
  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists legal_acceptances_user_idx on public.legal_acceptances(user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

-- הלקוח רואה את ההסכמות שלו בלבד. הכתיבה עוברת דרך השרת בלבד,
-- אחרת אפשר היה לזייף חותמת הסכמה מהדפדפן.
drop policy if exists "legal_acceptances_read_own" on public.legal_acceptances;
create policy "legal_acceptances_read_own" on public.legal_acceptances
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- סיכום על הפרופיל, לשאילתה מהירה בלי join.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

comment on column public.profiles.terms_version is
  'גרסת המסמכים שאושרה לאחרונה. אי-התאמה ל-LEGAL_VERSION מחייבת אישור מחדש.';

-- ─────────────────────────────────────────────────────────────────────────────
-- בחירת מסלול מחייבת אישור מפורש, ולכן select_trial_plan מקבלת אותו כארגומנט
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.select_trial_plan();

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
-- אישור בהרשמה ובמסלול בתשלום, בקריאה מהשרת
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_legal_acceptance(
  target_user uuid,
  acceptance_context text,
  accepted_version text,
  client_ip text default null,
  client_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.legal_acceptances (user_id, context, document_version, documents, ip_address, user_agent)
  values (
    target_user, acceptance_context, accepted_version,
    array['terms', 'privacy', 'acceptable-use', 'refund', 'cookies'],
    nullif(client_ip, '')::inet, client_agent
  );

  update public.profiles
  set terms_accepted_at = now(), terms_version = accepted_version, updated_at = now()
  where id = target_user;
end;
$$;

revoke execute on function public.record_legal_acceptance(uuid, text, text, text, text) from public, anon, authenticated;
