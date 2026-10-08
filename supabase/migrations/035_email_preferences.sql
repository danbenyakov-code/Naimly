-- העדפות דיוור, וטוקן להסרה בלחיצה אחת.
--
-- מיילים קריטיים (קוד אימות, איפוס סיסמה, תשלום וקבלה, התראה על פנייה)
-- תמיד נשלחים ואינם תלויים בטבלה הזו. כל מייל אחר נבדק מולה לפני שליחה.
--
-- ברירת מחדל: הכל פעיל. הטוקן אקראי (256 ביט), ייחודי, ומאפשר הסרה בלי
-- התחברות. הוא לעולם אינו נגזר מהמזהה או מהמייל, ולכן לא ניתן לניחוש.
--
-- Rollback:
--   drop trigger if exists email_preferences_on_profile_insert on public.profiles;
--   drop trigger if exists email_preferences_log_changes on public.email_preferences;
--   drop function if exists public.email_preferences_profile_insert();
--   drop function if exists public.email_preferences_log_changes();
--   drop function if exists public.user_card_stats(uuid, timestamptz, timestamptz);
--   drop table if exists public.email_preferences;

create table if not exists public.email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  trial_reminders boolean not null default true,
  weekly_report boolean not null default true,
  product_updates boolean not null default true,
  marketing boolean not null default true,
  unsubscribe_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);

comment on table public.email_preferences is
  'העדפות דיוור למיילים שאינם קריטיים. unsubscribe_token = הסרה בלחיצה אחת בלי התחברות.';

drop trigger if exists email_preferences_set_updated_at on public.email_preferences;
create trigger email_preferences_set_updated_at before update on public.email_preferences
  for each row execute function public.set_updated_at();

alter table public.email_preferences enable row level security;

-- המשתמש קורא ומעדכן רק את ההעדפות שלו. הטוקן עצמו אינו ניתן לשינוי מהלקוח.
drop policy if exists "email_preferences_read_own" on public.email_preferences;
create policy "email_preferences_read_own" on public.email_preferences
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "email_preferences_update_own" on public.email_preferences;
create policy "email_preferences_update_own" on public.email_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on public.email_preferences from anon, authenticated;
grant update (trial_reminders, weekly_report, product_updates, marketing, updated_at)
  on public.email_preferences to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- שורה לכל משתמש: חדש בטריגר, קיימים בשחזור
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.email_preferences_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists email_preferences_on_profile_insert on public.profiles;
create trigger email_preferences_on_profile_insert
  after insert on public.profiles
  for each row execute function public.email_preferences_profile_insert();

insert into public.email_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- כל ביטול נרשם ביומן הלקוח (unsubscribed), מכל מקור: מסך ההגדרות,
-- קישור ההסרה במייל או כפתור ההסרה של Gmail.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.email_preferences_log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  turned_off text[] := array[]::text[];
begin
  if old.trial_reminders and not new.trial_reminders then turned_off := turned_off || 'trial_reminders'::text; end if;
  if old.weekly_report and not new.weekly_report then turned_off := turned_off || 'weekly_report'::text; end if;
  if old.product_updates and not new.product_updates then turned_off := turned_off || 'product_updates'::text; end if;
  if old.marketing and not new.marketing then turned_off := turned_off || 'marketing'::text; end if;
  if array_length(turned_off, 1) > 0 then
    perform public.log_user_event(new.user_id, 'unsubscribed', jsonb_build_object('categories', to_jsonb(turned_off)));
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists email_preferences_log_changes on public.email_preferences;
create trigger email_preferences_log_changes
  after update on public.email_preferences
  for each row execute function public.email_preferences_log_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- נתוני הכרטיסים של משתמש בטווח זמן: הבסיס למיילי הניסיון ולדוח השבועי.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.user_card_stats(target_user uuid, since timestamptz, until timestamptz default now())
returns table (
  views bigint,
  clicks bigint,
  whatsapp bigint,
  phone bigint,
  navigation bigint,
  contact_save bigint,
  leads bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where ce.event_type in ('view', 'qr_scan')),
    count(*) filter (where ce.event_type not in ('view', 'qr_scan', 'lead')),
    count(*) filter (where ce.event_type in ('whatsapp', 'whatsapp_primary')),
    count(*) filter (where ce.event_type = 'phone'),
    count(*) filter (where ce.event_type in ('waze', 'google_maps', 'map')),
    count(*) filter (where ce.event_type = 'contact_save'),
    (select count(*) from public.leads l join public.cards c2 on c2.id = l.card_id
      where c2.user_id = target_user and l.created_at >= since and l.created_at < until)
  from public.card_events ce
  join public.cards c on c.id = ce.card_id
  where c.user_id = target_user and ce.created_at >= since and ce.created_at < until;
$$;

revoke execute on function public.user_card_stats(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.user_card_stats(uuid, timestamptz, timestamptz) to service_role;
