# פריסה ל־Vercel וחיבור שירותים

## 1. הכנה

1. עדכון המיתוג והמחירים ב־`src/lib/config.ts`.
2. הרצת `npm run check`.
3. יצירת פרויקט Supabase והרצת המיגרציה.
4. יצירת מאגר Git ודחיפת branch ראשי.

## 2. Vercel

1. Import Project מתוך Git.
2. Root Directory נשאר שורש המאגר.
3. `vercel.json` שבמאגר כבר קובע framework, Build Command ו‑Install Command.
4. **Node.js Version חייב להיות 20.x או 22.x.** Next 16 דורש Node >= 20.9,
   ופרויקט Vercel שנשאר על 18.x נכשל בבנייה מיד. ההגדרה נמצאת ב‑
   Project → Settings → General → Node.js Version. במאגר קיימים גם
   `engines.node` ב‑`package.json` וגם `.nvmrc` כדי לקבע את הבחירה.
5. הוספת כל משתני הסביבה (ראו `.env.example`) — לכל הסביבות שרלוונטיות.
6. Deploy.

לאחר הפריסה, יש לעדכן את `NEXT_PUBLIC_SITE_URL` לכתובת Production ולבצע Redeploy.

### כשהבנייה נכשלת

הבנייה עוברת נקי בסביבה נקייה (`npm ci && next build`), ולכן כשל ב‑Vercel כמעט
תמיד נובע מהגדרות הפרויקט. סדר הבדיקה:

| התסמין בלוג | הסיבה | התיקון |
|--------------|--------|---------|
| `You are using Node.js 18.x. For Next.js, Node.js version >= v20.9.0 is required` | גרסת Node של הפרויקט | שינוי ל‑20.x/22.x בהגדרות הפרויקט |
| `npm ci` נכשל על `EUSAGE` / lock מיושן | `package-lock.json` לא עודכן יחד עם `package.json` | `npm install` מקומי ודחיפת ה‑lock |
| `Environment Variable "X" references Secret "y", which does not exist` | הפניה ל‑Secret ישן בהגדרות | הזנת הערך ישירות במשתני הסביבה |
| `Module not found: Can't resolve '@/...'` | Root Directory שגוי | Root Directory = שורש המאגר |
| הבנייה נתקעת בשלב ההעלאה | פריסה מתיקייה שאינה מאגר Git, עם `node_modules` | פריסה מ‑Git; `.vercelignore` שבמאגר מסנן את השאר |

הרצה מקומית שמשחזרת בדיוק את מה ש‑Vercel עושה:

```bash
rm -rf node_modules .next
npm ci
npm run check
```

### מיגרציות

יש להריץ את הקבצים ב‑`supabase/migrations` לפי הסדר. מיגרציה `003` מוסיפה את
אכיפת המסלולים וההתנסות ברמת מסד הנתונים והיא **חובה** — בלעדיה ניתן לעקוף את
מגבלות החבילות בפנייה ישירה ל‑API של Supabase.

## 3. Supabase Auth

יש להוסיף ב־Supabase את כתובות ההפניה:

- `https://YOUR_DOMAIN/auth/callback`
- כתובות Preview של Vercel רק אם רוצים לבדוק התחברות גם בסביבות Preview.

יש להחליט אם Email Confirmation פעיל. כאשר הוא פעיל, משתמש חדש יקבל קישור אימות לפני הכניסה.

## 4. תשלום בביט דרך וואטסאפ

התשלום אינו נסלק באתר. המערכת פותחת בקשת תשלום עם אסמכתא, מעבירה את הלקוח
לוואטסאפ, ומנהל מאשר ידנית ב-`/admin/approvals`. הפירוט המלא ב-[BILLING.md](BILLING.md).

משתני הסביבה הנדרשים:

```
NEXT_PUBLIC_BILLING_WHATSAPP=9725XXXXXXXX   # חובה, אחרת מסך התשלום חסום
NEXT_PUBLIC_BIT_PHONE=05XXXXXXXX
NEXT_PUBLIC_BIT_NAME=NAIMLY
SUPABASE_SERVICE_ROLE_KEY=...               # חובה לאישורי מנהל
```

כדי להפוך משתמש למנהל, יש לעדכן ב-Supabase:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 5. Adapter דוא״ל וחשבוניות

שני ה־Adapters שולחים `POST` עם JSON וכותרת Bearer. יש להתאים את המבנה לספק שייבחר או להציב שכבת Make/Zapier/שרת תיווך שמקבלת את המבנה הקיים.

## 6. בדיקות לפני פתיחה לציבור

- הרשמה, אימות, כניסה, איפוס ויציאה.
- יצירת כרטיס, העלאת תמונה/PDF, פרסום ו־QR.
- הורדת vCard ובדיקה שהשם, הטלפון ושאר השדות נשמרים באנשי קשר.
- בדיקה שמשתמש א׳ אינו רואה נתוני משתמש ב׳.
- צפייה בכרטיס ללא התחברות.
- טופס פנייה, מייל לבעל העסק ושינוי סטטוס.
- אירועי אנליטיקה לאחר אישור פרטיות בלבד.
- Google Analytics / GTM / Meta Pixel אינם נטענים לפני הסכמה לעוגיות.
- בקשת תשלום, פתיחת וואטסאפ, אישור מנהל והפעלת מסלול.
- חסימה מלאה בתום ההתנסות: עריכה, העלאה והכרטיס הציבורי.
- מעבר למסלול נמוך יותר — התראת הגזימה מוצגת והגזימה מתבצעת.
- פתיחת חשבון על ידי מנהל ושליחת פרטי כניסה בוואטסאפ.
- בדיקות מובייל, מקלדת, קורא מסך וניגודיות (`npm run verify`).
- בדיקת `robots.txt`, `sitemap.xml`, canonical ו־Metadata.
- גיבוי ושחזור של Supabase בהתאם לתוכנית שנרכשה.
