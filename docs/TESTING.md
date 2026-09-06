# בדיקות ומשתמש בדיקה

## הרצת כל הבדיקות

```bash
npm run verify        # lint + typecheck + build + ביקורת מובייל + E2E
npm run test:flows    # זרימות מקצה לקצה מול שרת חי
```

| סקריפט | מה נבדק |
|---------|----------|
| `npm run check` | lint, typecheck, build |
| `npm run audit:mobile` | overflow אופקי, יעדי מגע, טבלאות, מודלים, טקסט זעיר |
| `npm run test:e2e` | כל עמוד, קישור, עוגן, נכס והרשאת API |
| `npm run test:flows` | טופס יצירת קשר, התחברות, הרשאות, תשלום, סקשנים |

`test:e2e` מעלה שרת בעצמו. `test:flows` דורש שרת שכבר רץ:

```bash
npm run build && npm start          # או על פורט אחר
npm run test:flows -- http://localhost:3000
```

## משתמש בדיקה

### בלי Supabase — מצב הדגמה

כשאין משתני Supabase, האתר עולה במצב הדגמה: **כל פרטי כניסה עובדים** ומובילים
לסביבה עם נתוני דוגמה. אין צורך במשתמש אמיתי.

```bash
NEXT_PUBLIC_DEMO_MODE=true DEMO_ADMIN=true npm run dev
```

`DEMO_ADMIN=true` פותח גם את `/admin` ו-`/admin/approvals`.
פעולות כתיבה חסומות בהדגמה במכוון — אין נתונים אמיתיים לשנות.

> בפרודקשן מצב ההדגמה כבוי כברירת מחדל, כדי שפריסה עם משתנים חסרים לא תיפתח
> לציבור. ראו `docs/SECURITY.md`.

### עם Supabase — יצירת משתמש אמיתי

```bash
node scripts/create-user.mjs \
  --email test@naimly.co.il \
  --password 'Test!2345678' \
  --name "בודק מערכת" \
  --role admin \
  --plan premium \
  --months 12
```

דורש `NEXT_PUBLIC_SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` (נטענים מ-`.env.local`).

| דגל | ערכים | ברירת מחדל |
|------|--------|-------------|
| `--role` | `customer` \| `admin` | `customer` |
| `--plan` | `trial` \| `basic` \| `pro` \| `premium` | `trial` |
| `--months` | מספר חודשי מנוי | `12` |

הסקריפט מאמת את המייל אוטומטית, כך שאפשר להתחבר מיד בלי לחכות לקוד.
אם המשתמש כבר קיים — הסיסמה וההרשאות מתעדכנות.

## מדיניות סיסמה

מוגדרת במקום אחד — `src/lib/password.ts` — ונאכפת גם בממשק וגם בשרת:

- לפחות 10 תווים
- אות גדולה, אות קטנה, ספרה ותו מיוחד
- חסימת סיסמאות נפוצות ורצף של אותו תו

חיווי החוזק בממשק נגזר מאותה פונקציה, כך שמה שנראה "חזק" באמת יתקבל בשרת.

## אימות במייל (OTP)

ההרשמה מסתיימת בקוד בן 6 ספרות שנשלח למייל. כדי שזה יעבוד ב-Supabase:

1. Authentication → Providers → Email → **Confirm email** פעיל.
2. Authentication → Email Templates → **Confirm signup** — לוודא שהתבנית
   כוללת `{{ .Token }}` (הקוד), ולא רק `{{ .ConfirmationURL }}`.

בלי `{{ .Token }}` יישלח רק קישור, והמשתמש לא יקבל קוד להזין.

## נגישות

- כל שדה חובה מסומן ויזואלית (`חובה`) וגם `aria-required`.
- שגיאות מקושרות לשדה ב-`aria-describedby`, מסומנות ב-`aria-invalid`
  ומוכרזות עם `role="alert"`.
- טופס יצירת הקשר מציג סיכום שגיאות בראש הטופס ומעביר אליו מיקוד.
- כל האנימציות מכבדות `prefers-reduced-motion` ואת מתג "עצירת אנימציות".
