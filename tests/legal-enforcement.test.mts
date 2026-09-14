import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  bindingDocumentIds,
  legalDocuments,
  legalEntity,
  requiresLegalReAcceptance,
} from "../src/lib/legal.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

/**
 * הקובץ בלי הערות.
 *
 * חיפוש מחרוזת בקובץ שלם מוצא גם הערה שמסבירה למה משהו *אינו* קיים,
 * ואז הבדיקה נכשלת דווקא כשהקוד נכון.
 *
 * נכתב כסריקת תווים ולא ברגקס: מחלקות תווים עם escapes נשברו בפרויקט
 * הזה כבר שלוש פעמים בעריכה אוטומטית, ובבדיקה שגיאה כזו עוברת בשקט.
 */
function stripComments(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    if (two === "//") {
      while (index < source.length && source[index] !== "\n") index += 1;
    } else if (two === "/*") {
      index += 2;
      while (index < source.length && source.slice(index, index + 2) !== "*/") index += 1;
      index += 2;
    } else {
      out += source[index];
      index += 1;
    }
  }
  return out;
}

const code = (path: string) => stripComments(read(path));

describe("אישור מחדש לאחר עדכון נוסח", () => {
  it("גרסה שאינה הנוכחית מחייבת אישור מחדש", () => {
    assert.equal(requiresLegalReAcceptance(LEGAL_VERSION), false);
    assert.equal(requiresLegalReAcceptance("2026-09-10"), true);
    assert.equal(requiresLegalReAcceptance(""), true);
    assert.equal(requiresLegalReAcceptance(undefined), true);
    assert.equal(requiresLegalReAcceptance(null), true);
  });

  it("רווחים מסביב לגרסה אינם מבטלים את האישור", () => {
    assert.equal(requiresLegalReAcceptance(` ${LEGAL_VERSION} `), false);
  });

  it("הגרסה והתאריך עודכנו יחד", () => {
    // גרסה שהתקדמה בלי שהתאריך התקדם פירושה מסמך שמציג תאריך שגוי.
    assert.equal(LEGAL_VERSION, "2026-09-14");
    assert.ok(LEGAL_EFFECTIVE_DATE.includes("14"), LEGAL_EFFECTIVE_DATE);
    assert.ok(LEGAL_EFFECTIVE_DATE.includes("ספטמבר"), LEGAL_EFFECTIVE_DATE);
  });
});

describe("האכיפה קיימת בכל שלוש השכבות", () => {
  it("שער הכניסה לדשבורד חוסם נוסח שלא אושר", () => {
    const layout = read("src/app/dashboard/layout.tsx");
    assert.ok(layout.includes("requiresLegalReAcceptance(viewer.termsVersion)"));
    assert.ok(layout.includes('redirect("/legal/accept")'));
  });

  it("ה-API חוסם גם בבקשה ישירה", () => {
    // חסימה בממשק בלבד היא הצגה: בקשה ישירה ל-API הייתה עוקפת אותה.
    const route = read("src/app/api/cards/route.ts");
    assert.ok(route.includes("requiresLegalReAcceptance(viewer.termsVersion)"));
    assert.ok(route.includes("terms_outdated"));
  });

  it("המסד דוחה אישור בלי גרסה", () => {
    const migration = read("supabase/migrations/016_legal_reacceptance.sql");
    assert.ok(migration.includes("TERMS_REQUIRED"));
    assert.ok(migration.includes("auth.uid()"));
    assert.ok(migration.includes("Rollback"));
  });

  it("פונקציית האישור אינה מקבלת מזהה משתמש מבחוץ", () => {
    /*
     * זו נקודת האבטחה של המיגרציה: record_legal_acceptance מקבלת
     * target_user ולכן נשללה מ-authenticated. accept_current_terms
     * פועלת על auth.uid() בלבד, ולכן בטוחה לחשיפה ללקוח.
     */
    const migration = read("supabase/migrations/016_legal_reacceptance.sql");
    assert.ok(migration.includes("grant execute on function public.accept_current_terms"));
    assert.ok(!migration.includes("accept_current_terms(\n  target_user"));
    assert.ok(!migration.includes("target_user uuid"));
  });

  it("דף האישור אינו מציע דרך לדלג", () => {
    const form = code("src/components/legal/accept-terms-form.tsx");
    assert.ok(!form.includes("אחר כך"), "אין לאפשר דחייה של האישור");
    assert.ok(!form.includes("דילוג"), "אין לאפשר דילוג על האישור");
    assert.ok(!form.includes("לא עכשיו"), "אין לאפשר דחייה של האישור");
  });

  it("יעד ההפניה אחרי האישור מוגבל לאותו מקור", () => {
    // בלי הבדיקה הזו הדף היה הופך לנקודת הפניה פתוחה לאתר זר.
    const action = read("src/app/legal/accept/actions.ts");
    assert.ok(action.includes("isSameOriginPath(requested)"));
  });
});

describe("תיעוד ההסכמה נשלח למנהל", () => {
  it("נשלח בשלושת המסלולים", () => {
    for (const path of [
      "src/app/onboarding/plan/actions.ts",
      "src/app/api/payments/request/route.ts",
      "src/app/legal/accept/actions.ts",
    ]) {
      assert.ok(read(path).includes("sendLegalAcceptanceNotification"), `${path} אינו שולח תיעוד`);
    }
  });

  it("נשלח לכתובת המנהל ולא ללקוח", () => {
    for (const path of [
      "src/app/onboarding/plan/actions.ts",
      "src/app/api/payments/request/route.ts",
      "src/app/legal/accept/actions.ts",
    ]) {
      assert.ok(read(path).includes("to: adminNotificationEmail"), `${path} שולח ליעד שגוי`);
    }
  });

  it("התיעוד כולל את פרטי ההתקשרות ואת הראיות", () => {
    const email = read("src/lib/email.ts");
    for (const field of ["customerName", "customerEmail", "customerPhone", "documentVersion", "acceptedAt", "ip", "userAgent"]) {
      assert.ok(email.includes(field), `חסר ${field} בתיעוד`);
    }
  });

  it("התיעוד נשלח רק אחרי שהרישום במסד הצליח", () => {
    /*
     * מייל שמעיד על אישור שלא נרשם הוא ראיה שגויה, וגרועה מהיעדר
     * ראיה. בזרימת ההתנסות השליחה חייבת להיות אחרי בדיקת השגיאה.
     */
    const action = read("src/app/onboarding/plan/actions.ts");
    const errorCheck = action.indexOf("if (error) {");
    // הקריאה בפועל, לא שורת ה-import שמופיעה לפניה בקובץ.
    const sendCall = action.indexOf("await sendLegalAcceptanceNotification({");
    assert.ok(errorCheck > 0, "לא נמצאה בדיקת השגיאה");
    assert.ok(sendCall > errorCheck, "התיעוד נשלח לפני בדיקת השגיאה");
  });

  it("התיעוד נשלח לפני ה-redirect, אחרת הוא לא ירוץ כלל", () => {
    // redirect זורק חריגה, וכל מה שאחריו לא מתבצע.
    const action = read("src/app/onboarding/plan/actions.ts");
    const sendCall = action.indexOf("await sendLegalAcceptanceNotification({");
    const redirectCall = action.indexOf('redirect("/dashboard?trial=started")');
    assert.ok(sendCall > 0, "לא נמצאה קריאת השליחה");
    assert.ok(redirectCall > sendCall, "התיעוד נשלח אחרי ה-redirect");
  });
});

describe("התנסות אחת לכל כתובת דוא״ל (REQ-014)", () => {
  const migration = read("supabase/migrations/017_one_trial_per_email.sql");

  it("האכיפה היא במסד ולא בקוד בלבד", () => {
    /*
     * בדיקה ואז כתיבה בקוד היו שתיהן עוברות בבקשות מקבילות. מפתח
     * ראשי על הכתובת המנורמלת הוא מה שבאמת מונע את הכפילות.
     */
    assert.ok(migration.includes("normalized_email text primary key"));
    assert.ok(migration.includes("TRIAL_ALREADY_USED"));
  });

  it("הנרמול סוגר את העקיפות המובנות מאליהן", () => {
    // בלי זה ההגבלה נעקפת ב-a+1@gmail.com או ב-a.b@gmail.com.
    assert.ok(migration.includes("split_part(local_part, '+', 1)"));
    assert.ok(migration.includes("replace(local_part, '.', '')"));
    assert.ok(migration.includes("googlemail.com"));
  });

  it("מי שכבר מימש נרשם למפרע", () => {
    // בלי זה ההגבלה הייתה חלה רק על מי שנרשם מהיום.
    assert.ok(migration.includes("insert into public.trial_email_claims"));
    assert.ok(migration.includes("from public.subscriptions s"));
  });

  it("הלקוח מקבל הסבר ולא שגיאה כללית", () => {
    const action = read("src/app/onboarding/plan/actions.ts");
    assert.ok(action.includes("TRIAL_ALREADY_USED"));
    assert.ok(action.includes("אפשר להמשיך במסלול בתשלום"));
  });

  it("ההגבלה מופיעה גם בתנאי השימוש", () => {
    const terms = read("src/components/legal/documents/terms-body.tsx");
    assert.ok(terms.includes("חשבון אחד לכל כתובת דוא״ל"), "התחייבות שאינה מופיעה בתקנון");
  });
});

describe("עקביות בין המסמכים", () => {
  it("זהות הספק ללא פרטים שנמחקו", () => {
    const terms = read("src/components/legal/documents/terms-body.tsx");
    assert.equal(legalEntity.displayName, "NAIMLY – נעים לי");
    for (const placeholder of ["ח.פ.", "ע.מ.", "[מספר]", "[כתובת]", "[שם"]) {
      assert.ok(!terms.includes(placeholder), `נשאר במסמך: ${placeholder}`);
    }
  });

  it("אין הפניות לסעיפים שכבר לא קיימים", () => {
    /*
     * מספור התקנון השתנה, ומדיניות אחרות הפנו לסעיף 8.1 שהפך ל-15.1.
     * הפניה שבורה במסמך משפטי היא בדיוק מה שמכריע לרעת הספק.
     */
    for (const path of ["src/components/legal/documents/refund-body.tsx", "src/components/legal/documents/acceptable-use-body.tsx"]) {
      const content = read(path);
      assert.ok(!content.includes("סעיף 8.1 ל<Link"), `${path} מפנה לסעיף שאינו קיים`);
      assert.ok(!content.includes("בסעיף 8 שם"), `${path} מפנה לסעיף שאינו קיים`);
    }
  });

  it("כל מסמך מחייב מופיע ברשימת המסמכים", () => {
    for (const id of bindingDocumentIds) {
      assert.ok(legalDocuments.some((doc) => doc.id === id), `${id} חסר ברשימה`);
    }
  });

  it("לכל מסמך ברשימה יש עמוד בפועל", () => {
    // קישור לעמוד שאינו קיים במסמך משפטי הוא הפניה למסמך שלא נמסר.
    for (const doc of legalDocuments) {
      const path = `src/app${doc.href}/page.tsx`;
      assert.ok(fs.existsSync(path), `חסר עמוד עבור ${doc.id} (${path})`);
    }
  });

  it("טבלת המחירים בתקנון נגזרת ואינה מוקלדת", () => {
    /*
     * תעריף שהוקלד לתוך התקנון היה נשאר מאחור בכל שינוי מחיר, ומסמך
     * משפטי שנוקב במחיר שאינו נגבה הוא סתירה מול הלקוח.
     */
    const terms = read("src/components/legal/documents/terms-body.tsx");
    assert.ok(terms.includes("plans.filter"));
    assert.ok(terms.includes("annualPrice(plan.price)"));
    assert.ok(terms.includes("annualSaving(plan.price)"));
    assert.ok(!terms.includes("290 ₪"), "מחיר מוקלד ידנית בתקנון");
    assert.ok(!terms.includes("790 ₪"), "מחיר מוקלד ידנית בתקנון");
  });
});
