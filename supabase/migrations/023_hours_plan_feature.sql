-- שעות פעילות כיכולת של מסלול.
--
-- השעות היו זמינות לכל מסלול. הן אמורות להיות חלק מהערך של מקצועי
-- ומעלה, ולכן בסיסי מאבד אותן — והאכיפה חייבת להיות גם כאן ולא רק
-- בממשק, אחרת בקשה ישירה ל-API שומרת שעות למסלול שאינו כולל אותן.
--
-- Rollback:
--   alter table public.plan_limits drop column if exists allow_hours;
--   drop trigger if exists cards_enforce_hours on public.cards;
--   drop function if exists public.enforce_hours_limit();

alter table public.plan_limits add column if not exists allow_hours boolean not null default true;

update public.plan_limits set allow_hours = false where plan_id in ('basic', 'none');
update public.plan_limits set allow_hours = true  where plan_id in ('trial', 'pro', 'premium');

create or replace function public.enforce_hours_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan text;
  lim public.plan_limits%rowtype;
begin
  -- כתיבה עם service-role עוקפת את האכיפה במכוון, כמו בשאר הטריגרים.
  if auth.uid() is null then
    return new;
  end if;

  plan := coalesce(public.effective_plan(new.user_id), 'trial');
  select * into lim from public.plan_limits where plan_id = plan;
  if not found then
    select * into lim from public.plan_limits where plan_id = 'trial';
  end if;

  if not lim.allow_hours and jsonb_array_length(coalesce(new.opening_hours, '[]'::jsonb)) > 0 then
    raise exception 'PLAN_LIMIT:hours:שעות פעילות זמינות במסלול מקצועי ומעלה.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists cards_enforce_hours on public.cards;
create trigger cards_enforce_hours
  before insert or update on public.cards
  for each row execute function public.enforce_hours_limit();
