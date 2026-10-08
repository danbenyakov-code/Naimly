-- סגירת פרצה: בחירת מסלול בתשלום בלי תשלום נתנה גישת התנסות לשנה.
--
-- איך זה קרה: handle_new_user יוצר מנוי 'trialing' עם current_period_end
-- של שנה קדימה (מיגרציה 010), כדי שלא ייווצר מצב ביניים. לקוח שבוחר מסלול
-- בתשלום עובר דרך mark_plan_selected, שמסמן plan_selected_at ולא נוגע
-- בתאריך. מכאן effective_plan החזיר 'trial' ו-subscription_live החזיר
-- true עד שנה מההרשמה: גישה מלאה לכל היכולות וכרטיס ציבורי באוויר, בלי
-- לשלם. כולל מי שכתובת המייל שלו כבר מימשה התנסות (REQ-014).
--
-- התיקון, בשתי שכבות:
--   1. "התנסות" קיימת רק כשהתחילה בפועל (trial_started_at). בלי זה אין גישה.
--   2. mark_plan_selected סוגר את התאריך הרחוק כשאין התנסות שרצה.
-- לקוח שכבר בהתנסות ובוחר מסלול בתשלום ממשיך את ההתנסות שלו עד סופה.
--
-- נכון ליום ההחלה: אין אף מנוי במצב הזה (נבדק לפני הכתיבה).
--
-- Rollback: להחיל מחדש את effective_plan ו-subscription_live ממיגרציה 030,
-- ואת mark_plan_selected ממיגרציה 010.

create or replace function public.effective_plan(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.admin_locked then 'none'
      when s.plan_selected_at is null then 'none'
      when s.status = 'active' and coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then s.plan_id
      when s.status = 'trialing' and s.trial_started_at is not null and s.current_period_end > now() then 'trial'
      else 'none'
    end
    from public.subscriptions s
    where s.user_id = target_user
  ), 'none');
$$;

create or replace function public.subscription_live(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.admin_locked then false
      when s.plan_selected_at is null then false
      when s.status = 'active' and coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then true
      when s.status = 'trialing' and s.trial_started_at is not null and s.current_period_end > now() then true
      else false
    end
    from public.subscriptions s where s.user_id = target_user
  ), false);
$$;

grant execute on function public.subscription_live(uuid) to anon, authenticated;

create or replace function public.mark_plan_selected(target_user uuid, target_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set plan_selected_at = coalesce(plan_selected_at, now()),
      trial_pending = false,
      -- בלי התנסות שרצה אין "זמן חסד": הגישה נפתחת רק באישור התשלום.
      current_period_end = case when trial_started_at is null and status = 'trialing' then now() else current_period_end end,
      updated_at = now()
  where user_id = target_user;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (target_user, 'plan.select', 'user', target_user::text,
          jsonb_build_object('plan', target_plan));
end;
$$;

revoke execute on function public.mark_plan_selected(uuid, text) from public, anon, authenticated;

-- ליתר ביטחון: מנוי שכבר במצב הזה (אין כרגע) נסגר.
update public.subscriptions
set current_period_end = least(current_period_end, now()), updated_at = now()
where status = 'trialing' and trial_started_at is null and plan_selected_at is not null;
