-- activate_subscription הפעילה מנוי בתשלום בלי לסמן plan_selected_at.
--
-- בזרימת התשלום האמיתית זה לא נורא: mark_plan_selected כבר רץ קודם,
-- כשהלקוח פתח את בקשת התשלום. אבל scripts/create-user.mjs (יצירת
-- משתמש בדיקה/מנהל דרך הטרמינל) קורא ל-activate_subscription ישירות,
-- בלי לעבור דרך מסך תשלום כלל — ולכן plan_selected_at נשאר null,
-- effective_plan() מחזירה 'none' למרות מנוי פעיל, והמשתמש ננעל בשער
-- ההצטרפות (הפניה חוזרת ל-onboarding/plan) חרף מסלול פרימיום פעיל.
--
-- התיקון: activate_subscription מסמנת plan_selected_at בעצמה, באותה
-- לוגיקת coalesce שכבר קיימת ב-mark_plan_selected — לא דורס בחירה
-- קודמת, רק ממלא אותה כשהיא חסרה.

create or replace function public.activate_subscription(
  target_user uuid,
  target_plan text,
  months integer default 1,
  actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, plan_selected_at)
  values (target_user, target_plan, 'active', 'bit', now() + (months || ' months')::interval, now())
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    provider = 'bit',
    current_period_end = excluded.current_period_end,
    plan_selected_at = coalesce(public.subscriptions.plan_selected_at, now()),
    updated_at = now();

  update public.profiles
  set plan_id = target_plan, approved_at = coalesce(approved_at, now()), updated_at = now()
  where id = target_user;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (actor, 'subscription.activate', 'user', target_user::text,
          jsonb_build_object('plan', target_plan, 'months', months));
end;
$$;

-- Rollback:
--   ראו הגדרת activate_subscription ב-004_bit_payments_and_approvals.sql
--   (ללא plan_selected_at) והחל אותה מחדש עם create or replace function.
