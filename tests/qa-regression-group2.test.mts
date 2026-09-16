import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("QA-009 — מיקוד אחרי כשל בטופס", () => {
  it("סיכום השגיאות ניתן למיקוד ומוכרז", () => {
    const field = read("src/components/ui/field.tsx");
    assert.ok(field.includes('role="alert"'));
    assert.ok(field.includes("tabIndex={-1}"));
    assert.ok(field.includes("data-error-summary"));
  });

  it("המיקוד התוכנתי נראה על המסך", () => {
    /*
     * זו הייתה אחת משתי התקלות: הטבעת הוגדרה על focus-visible בלבד,
     * ו-focus() תוכנתי אינו מפעיל את המצב הזה ברוב הדפדפנים. המיקוד
     * אכן עבר — אבל שום דבר לא השתנה, וזה נראה כמו כשל.
     */
    const field = read("src/components/ui/field.tsx");
    assert.ok(field.includes("focus:shadow-[0_0_0_3px_rgba(201,52,69,.25)]"));
    assert.ok(!field.includes("focus-visible:shadow-[0_0_0_3px_rgba(201,52,69,.25)]"));
  });

  it("כל שדה בטופס הקשר מעביר name", () => {
    /*
     * התקלה השנייה: בלי name אין data-field, ולכן קישורי הסיכום חיפשו
     * אלמנט שאינו קיים — לחיצה עליהם לא עשתה דבר.
     */
    const form = read("src/components/contact/contact-form.tsx");
    for (const name of ["name", "email", "phone", "message"]) {
      assert.ok(form.includes(`<Field label="`), "מבנה הטופס השתנה");
      assert.ok(form.includes(`name="${name}"`), `השדה ${name} ללא name`);
    }
  });

  it("קישור לשדה שאינו קיים אינו מאבד את המיקוד", () => {
    const field = read("src/components/ui/field.tsx");
    assert.ok(field.includes("if (!target) return;"));
  });
});

describe("NEW-005 — OTP למילוי אוטומטי", () => {
  const otp = read("src/components/auth/otp-input.tsx");

  it("רמזי המקלדת והמילוי האוטומטי קיימים", () => {
    assert.ok(otp.includes('inputMode="numeric"'));
    assert.ok(otp.includes('pattern="[0-9]*"'));
    assert.ok(otp.includes('enterKeyHint="done"'));
  });

  it("ההצעה זמינה בכל תיבה ולא רק בראשונה", () => {
    // iOS מציע את הקוד לשדה שבמיקוד; מי שלחץ על התיבה השלישית לא קיבל דבר.
    assert.ok(otp.includes('autoComplete="one-time-code"'));
    assert.ok(!otp.includes('autoComplete={index === 0 ? "one-time-code" : "off"}'));
  });

  it("הדבקת קוד מלא מפוצלת לכל התיבות", () => {
    assert.ok(otp.includes("clean.slice(0, length).split(\"\")"));
  });

  it("Backspace חוזר אחורה", () => {
    assert.ok(otp.includes('event.key === "Backspace"'));
  });

  it("החיצים תואמים לכיוון התצוגה", () => {
    // המכל הוא dir="ltr", ולכן ימינה מתקדם ושמאלה חוזר.
    assert.ok(otp.includes('if (event.key === "ArrowLeft" && index > 0)'));
    assert.ok(otp.includes('if (event.key === "ArrowRight" && index < length - 1)'));
  });

  it("התווית מקושרת לקבוצה", () => {
    // aria-labelledby הצביע למזהה שלא היה קיים כלל.
    assert.ok(otp.includes("id={`${id}-label`}"));
    assert.ok(otp.includes("aria-labelledby={`${id}-label`}"));
  });

  it("הערך נשלח כשדה לוגי אחד", () => {
    assert.ok(otp.includes('<input type="hidden" name={name} value={value} />'));
  });

  it("שם ואימייל נשמרים אחרי כשל", () => {
    const form = read("src/components/auth/auth-form.tsx");
    assert.ok(form.includes('keptValue(signupState, "fullName")'));
    assert.ok(form.includes('keptValue(signupState, "email")'));
  });

  it("טיימר השליחה החוזרת מנוקה ואינו מוכפל", () => {
    const resend = read("src/components/auth/resend-button.tsx");
    assert.ok(resend.includes("setInterval"));
    assert.ok(resend.includes("clearInterval"));
  });
});

describe("QA-033 — התראת ליד", () => {
  const route = read("src/app/api/leads/route.ts");

  it("הליד נשמר לפני ניסיון השליחה", () => {
    // הקריאה בפועל, לא שורת ה-import שמופיעה לפניה בקובץ.
    const insert = route.indexOf('.insert({ card_id: card.id');
    const send = route.indexOf("await sendLeadNotification({");
    assert.ok(insert > 0, "לא נמצאה שמירת הליד");
    assert.ok(send > insert, "המייל נשלח לפני השמירה");
  });

  it("כשל במייל אינו מאבד את הליד", () => {
    assert.ok(route.includes(".catch("), "כשל שליחה חייב להיבלע");
    assert.ok(route.includes('notification_status: delivery.sent ? "sent" : "failed"'));
  });

  it("סטטוס המסירה נשמר", () => {
    const migration = read("supabase/migrations/027_lead_delivery_status.sql");
    for (const state of ["pending", "sent", "failed", "skipped"]) {
      assert.ok(migration.includes(`'${state}'`), `חסר סטטוס ${state}`);
    }
    assert.ok(migration.includes("Rollback"));
  });

  it("סיבת הכשל נשמרת בלי תוכן הפנייה", () => {
    // שדה אבחון אינו מקום לתוכן שהמשתמש כתב.
    assert.ok(route.includes("delivery.reason"));
    assert.ok(!route.includes("notification_error: parsed.data.message"));
  });

  it("ההתראה נשלחת לבעל הכרטיס ולא למנהל המערכת", () => {
    assert.ok(route.includes("card.lead_notification_email"));
    assert.ok(route.includes("owner?.email"));
    assert.ok(!route.includes("adminNotificationEmail"));
  });

  it("כיבוי ההתראות מסומן ואינו נספר ככשל", () => {
    assert.ok(route.includes('notification_status: "skipped"'));
  });
});

describe("REQ-016 — מסמכים בחלונית גם בהרשמה", () => {
  const form = read("src/components/auth/auth-form.tsx");

  it("הקישורים אינם מנווטים מחוץ לטופס", () => {
    assert.ok(!form.includes('href="/legal/terms"'), "ניווט החוצה מאבד את מה שהוקלד");
    assert.ok(!form.includes('href="/legal/privacy"'));
  });

  it("נעשה שימוש בחלונית המשותפת", () => {
    assert.ok(form.includes('<LegalLink docId="terms">'));
    assert.ok(form.includes('<LegalLink docId="privacy">'));
  });

  it("האישור עדיין מפורש ואינו נגזר מפתיחת המסמך", () => {
    // פתיחת מסמך אינה הסכמה; רק סימון התיבה נחשב.
    assert.ok(form.includes('name="terms"'));
  });
});
