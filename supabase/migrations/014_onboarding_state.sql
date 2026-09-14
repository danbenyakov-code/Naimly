-- מצב ההדרכה הראשונית, ברמת המשתמש.
--
-- QA-020/REQ-005: הסיור היה קיים אך רץ רק במצב הדגמה, ומצבו נשמר
-- ב-localStorage. לקוח אמיתי לא ראה אותו מעולם, ומי שכן — ראה אותו
-- שוב בכל דפדפן ובכל מכשיר. מצב שקשור למשתמש שייך למשתמש.
--
-- Rollback:
--   alter table public.profiles drop column if exists onboarding_seen_at;

alter table public.profiles add column if not exists onboarding_seen_at timestamptz;

comment on column public.profiles.onboarding_seen_at is
  'מתי המשתמש סיים או דילג על ההדרכה. null = טרם ראה.';

-- המשתמש מסמן בעצמו שסיים; אין כאן מידע רגיש ואין סיבה לעבור דרך השרת.
grant update (onboarding_seen_at, updated_at) on public.profiles to authenticated;
