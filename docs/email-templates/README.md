# תבניות המייל של Supabase Auth

## למה זה חובה ולא קוסמטי

האפליקציה מאמתת **קוד בן 6 ספרות**, לא קישור:

| זרימה | קוד | קובץ |
|---|---|---|
| אימות הרשמה | `verifyOtp({ type: "signup" })` | [`actions.ts:172`](../../src/app/%28auth%29/actions.ts#L172) |
| שחזור סיסמה | `verifyOtp({ type: "recovery" })` | [`actions.ts:256`](../../src/app/%28auth%29/actions.ts#L256) |

תבנית ברירת המחדל של Supabase מכילה רק `{{ .ConfirmationURL }}` — קישור, בלי קוד.
**בלי להוסיף `{{ .Token }}` הקוד לא מגיע למשתמש, ואי אפשר להשלים הרשמה ואי אפשר לאפס סיסמה.**

## דרך א׳ — פקודה אחת (מומלץ)

```bash
# חד-פעמי: https://supabase.com/dashboard/account/tokens → Generate new token
echo "SUPABASE_ACCESS_TOKEN=sbp_..." >> .env.local

npm run supabase:auth              # מציג מה ישתנה, בלי לכתוב
npm run supabase:auth -- --apply   # כותב בפועל
```

הסקריפט מחיל את שתי התבניות, את פרטי ה-SMTP מ-`.env.local`, ובנוסף מיישר
שני ערכים שהדשבורד וברירת המחדל סותרים בהם את הקוד:

| ערך | ברירת מחדל | נקבע ל- | למה |
|---|---|---|---|
| `mailer_otp_length` | 6 | 6 | `OTP_LENGTH` ב-[`auth-schema.ts`](../../src/lib/auth-schema.ts) |
| `mailer_otp_exp` | 3600 שנ׳ | 600 שנ׳ | האפליקציה מבטיחה למשתמש 10 דקות |

אחרי הכתיבה הסקריפט **קורא בחזרה ומשווה**. אם ערך לא נתפס הוא נכשל, ולא
מדווח על הצלחה שלא קרתה. הסיסמה לעולם לא נכתבת ללוג — רק אורכה.

## דרך ב׳ — ידנית בדשבורד

### איפה זה בדשבורד

https://supabase.com/dashboard/project/pssdmwftostpvmzvtuuz/auth/templates

בסרגל הצד: **Authentication → Emails**. (בגרסאות קודמות הפריט נקרא Email Templates.)
בתוך המסך יש טאב לכל סוג מייל; דרושים שניים:

| טאב בדשבורד | קובץ להדבקה |
|---|---|
| Confirm signup | [`confirm-signup.html`](confirm-signup.html) |
| Reset password | [`reset-password.html`](reset-password.html) |

מעתיקים את תוכן הקובץ ומדביקים בשדה ה-HTML של הטאב. התבניות בעברית עם `dir="rtl"`,
בצבעי המותג (`#6d4aff`), וכוללות גם את הקוד וגם את הקישור — כי שתי הזרימות
עדיין מעבירות `emailRedirectTo` / `redirectTo` אל [`/auth/callback`](../../src/app/auth/callback/route.ts).

> הקוד והקישור הם **אותו טוקן חד-פעמי**. שימוש באחד מבטל את השני — זו התנהגות תקינה
> של או/או, ולכן הנוסח בתבנית הוא "לחלופין".

## המלכודת שתתפוס אותך מיד אחרי

**ה-SMTP שב-`.env.local` אינו משמש את מיילי ההרשמה.**

| מי שולח | מה | מקור ההגדרות |
|---|---|---|
| nodemailer (האפליקציה) | התראות לידים, בקשות תשלום, טופס קשר, פרטי כניסה | `SMTP_*` ב-`.env.local` — [`src/lib/email.ts`](../../src/lib/email.ts) |
| Supabase Auth | אימות הרשמה, שחזור סיסמה | הגדרות SMTP **בדשבורד של Supabase** |

בתוכנית החינמית שרת המייל המובנה של Supabase מוגבל למספר זעום של מיילים בשעה,
והוא נכשל **בלי שגיאה ברורה**. התוצאה: אחרי שתיים-שלוש בדיקות המיילים מפסיקים
להגיע, וקל להאשים את התבנית.

לכן באותו ביקור בדשבורד, בלשונית **SMTP Settings**, מזינים את אותם פרטים:

```
Host      smtp.gmail.com
Port      587
Username  info.naimly@gmail.com
Password  סיסמת האפליקציה (16 תווים, ללא רווחים)
Sender    info.naimly@gmail.com
```

זהו פריט **B4** ב-[`docs/implementation-status.md`](../implementation-status.md).

## אימות שזה עובד

```bash
npm run email:check                              # חיבור ואימות בלבד
npm run email:check -- --send you@example.com    # מייל אמיתי (nodemailer)
```

`email:check` בודק את **nodemailer** בלבד. את הזרימה של Supabase Auth בודקים
בהרשמה אמיתית במסך `/login` — צריך להתקבל מייל שמכיל קוד בן 6 ספרות.

### אימות מלא של הזרימה

```bash
npm run supabase:auth      # מציג האם ההגדרות בשרת תואמות לתבניות שבריפו
```

אם הוא מדפיס "כל ההגדרות כבר תואמות" — התבניות וה-SMTP הוחלו בהצלחה.
