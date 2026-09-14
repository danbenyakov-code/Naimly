# רקעי תמונה

כאן מעתיקים תמונות רקע. **אין למפות אותן ידנית לקוד** — הסקריפט עושה זאת.

```bash
node scripts/build-background-registry.mjs          # מה יקרה
node scripts/build-background-registry.mjs --apply  # עיבוד וכתיבה
```

הסקריפט מקטין ל-1400px, מדחס, **מודד את הבהירות הממוצעת** של כל תמונה
וקובע לפיה אם הטקסט מעליה יהיה כהה או בהיר. אומדן ידני של בהירות הוא
בדיוק מה שמייצר כרטיס שאי אפשר לקרוא.

## שמות קבצים

השם הופך למזהה ולשם התצוגה. קידומת קטגוריה משנה את השיוך:

| שם קובץ | מזהה | קטגוריה |
|---|---|---|
| `dark-marble.jpg` | `img-dark-marble` | creative |
| `luxury-gold-deco.jpg` | `img-luxury-gold-deco` | luxury |
| `minimal-white-paper.jpg` | `img-minimal-white-paper` | minimal |

קטגוריות מוכרות: `professional` · `minimal` · `luxury` · `colorful` ·
`dark` · `light` · `tech` · `creative` · `gradient` · `geometric`

## מה קורה כשתמונה חסרה

שום דבר לא נשבר. כל רקע תמונה נשמר עם **צבע נסיגה** שנמדד ממנה, ו-CSS
נופל אליו מעצמו כששכבת התמונה נכשלת.

## זכויות

כל תמונה כאן מוצגת בכרטיסים של לקוחות משלמים — שימוש מסחרי לכל דבר.
נדרש רישיון שמתיר זאת.
