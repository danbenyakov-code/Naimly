import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { PASSWORD_MIN_LENGTH, evaluatePassword, isStrongPassword, passwordRules } from "../src/lib/password.ts";
import { cardStrings } from "../src/lib/card-i18n.ts";

/**
 * בדיקות רגרסיה לקבוצה ג׳.
 *
 * חלק מהממצאים הם תכונות בסימון (scope, method, dir) שאין להן לוגיקה
 * לבדוק. במקום לוותר עליהם, הבדיקה קוראת את קובץ המקור ומאמתת שהתכונה
 * קיימת — זה תופס רגרסיה אמיתית, ולא מעמיד פנים שנבדקה התנהגות.
 */
const read = (path: string) => fs.readFileSync(path, "utf8");

describe("REQ-002 — סיסמה באורך 8 תווים", () => {
  it("המינימום הוא 8 ולא 10", () => {
    assert.equal(PASSWORD_MIN_LENGTH, 8);
  });

  it("סיסמה בת 7 תווים נדחית", () => {
    const result = evaluatePassword("Aa1!bcd");
    assert.equal(result.valid, false);
    assert.ok(result.failedRules.some((rule) => rule.id === "length"), "כלל האורך אמור להיכשל");
  });

  it("סיסמה בת 8 תווים עם כל מחלקות התווים מתקבלת", () => {
    const result = evaluatePassword("Aa1!bcde");
    assert.equal(result.valid, true, result.error);
    assert.equal(isStrongPassword("Aa1!bcde"), true);
  });

  it("אורך לבדו אינו מספיק — מחלקות התווים נשמרו", () => {
    assert.equal(evaluatePassword("aaaaaaaa").valid, false, "8 אותיות קטנות אינן סיסמה תקינה");
    assert.ok(passwordRules.length >= 4, "נדרשות לפחות ארבע מחלקות תווים");
  });
});

describe("QA-003 — טפסים שולחים ב-POST", () => {
  it("טופס יצירת הקשר מגדיר method=post", () => {
    const source = read("src/components/contact/contact-form.tsx");
    assert.match(source, /<form[^>]*method="post"/, "ללא method, כשל JS שולח GET והפרטים נכנסים ל-URL");
  });

  it("טופס הלידים בכרטיס הציבורי מגדיר method=post", () => {
    const source = read("src/components/card/public-card-client.tsx");
    assert.match(source, /<form[^>]*method="post"/);
  });
});

describe("QA-004 — כותרת H1 בכרטיס הציבורי", () => {
  /*
   * הכותרת נבחרת דינמית מאז פירוק הכרטיס לרכיבים. הבדיקה עברה מהסימון
   * לכלל עצמו — אותה התנהגות, בלי תלות באיך בדיוק נכתב ה-JSX.
   */
  it("שם בעל הכרטיס מוצג כ-H1 בתצוגה המלאה וכ-H2 במוקטנת", () => {
    const source = read("src/components/card/card-preview.tsx");
    assert.match(source, /const Heading = compact \? "h2" : "h1"/, "בלי H1 אין כותרת ראשית לקורא מסך ול-SEO");
    assert.match(source, /<Heading[^>]*>\s*\{card\.ownerName\}/);
  });

  it("אין כותרת ראשית נוספת במקטעים", () => {
    // שני H1 באותו עמוד שוללים את המשמעות של הראשון.
    const sections = read("src/components/card/sections/card-sections.tsx");
    assert.ok(!sections.includes("<h1"), "מקטע אינו רשאי לשאת H1");
  });
});

describe("QA-005 — טבלת המחירים נגישה", () => {
  const source = read("src/app/pricing/page.tsx");

  it("כותרות העמודות מוגדרות scope=col", () => {
    assert.match(source, /<th scope="col"/);
  });

  it("כותרות השורות מוגדרות scope=row", () => {
    assert.match(source, /<th scope="row"/);
  });

  it("סימוני הכללה נושאים טקסט נגיש", () => {
    assert.match(source, /aria-label="כלול"/);
    assert.match(source, /aria-label="לא כלול"/);
  });
});

describe("QA-006 — honeypot מוסתר, ואינו נגרר למילוי אוטומטי", () => {
  it("מוסתר מהעין, מקורא המסך ומסדר ה-Tab", () => {
    const honeypot = read("src/lib/honeypot.ts");
    assert.ok(honeypot.includes("tabIndex: -1"));
    assert.ok(honeypot.includes('"aria-hidden": true'));
    assert.ok(honeypot.includes('autoComplete: "off"'));

    for (const path of ["src/components/contact/contact-form.tsx", "src/components/card/public-card-client.tsx"]) {
      assert.ok(read(path).includes('className="sr-only"'), `${path} ללא הסתרה חזותית`);
      assert.ok(read(path).includes("honeypotInputProps"), `${path} אינו משתמש במקור המשותף`);
    }
  });

  it("השם אינו אסימון autofill מוכר", async () => {
    /*
     * זו הייתה התקלה האמיתית מאחורי QA-006, ומסתבר גם מאחורי QA-013
     * ו-QA-033: השדות נקראו "website" ו-"company" — שני אסימוני autofill
     * תקניים. הדפדפן מילא אותם, השרת ראה מלכודת שהופעלה, והפנייה נדחתה
     * בשקט עם תשובת הצלחה. שום ליד לא נשמר ושום מייל לא יצא.
     */
    const { HONEYPOT_FIELD } = await import("../src/lib/honeypot.ts");
    for (const token of ["website", "company", "url", "organization", "email", "name", "tel", "address"]) {
      assert.notEqual(HONEYPOT_FIELD, token);
    }
  });

  it("השמות הישנים אינם נבדקים יותר בשרת", () => {
    // דף ישן במטמון עדיין שולח אותם; בדיקתם הייתה ממשיכה לדחות לקוחות.
    const leads = read("src/app/api/leads/route.ts");
    assert.ok(!leads.includes("parsed.data.website"), "השם הישן עדיין נבדק");
  });
});

describe("QA-007 — סיכום שגיאות נגיש בהרשמה", () => {
  const source = read("src/components/auth/auth-form.tsx");

  it("הטופס מציג ErrorSummary", () => {
    assert.match(source, /<ErrorSummary/);
  });

  it("המיקוד עובר לסיכום אחרי כשל", () => {
    assert.match(source, /focusErrorSummary\(\)/);
  });

  it("noValidate מונע את הודעת הדפדפן באנגלית", () => {
    assert.match(source, /<form action=\{signup\} noValidate/);
  });
});

describe("QA-023 — אישור התנאים עם שגיאה בעברית", () => {
  const source = read("src/components/onboarding/plan-choice.tsx");

  it("הטופס אינו נשען על ולידציה טבעית", () => {
    assert.match(source, /<form action=\{submit\} noValidate/);
  });

  it("קיימת הודעת שגיאה עם role=alert", () => {
    assert.match(source, /role="alert"/);
  });
});

describe("QA-009 — הסיכום ממוקד אחרי רינדור", () => {
  it("המיקוד מופעל מתוך useEffect ולא מ-requestAnimationFrame", () => {
    const source = read("src/components/contact/contact-form.tsx");
    assert.match(source, /useEffect\(\(\) => \{\s*if \(focusSummary > 0\) focusErrorSummary\(\);/,
      "requestAnimationFrame רץ לפני ש-React מרנדר את הסיכום");
  });
});

describe("QA-008 — טופס הלידים אינו נשען על ולידציה טבעית", () => {
  const source = read("src/components/card/public-card-client.tsx");

  it("קיימת ולידציה בצד לקוח", () => {
    assert.match(source, /function validateLead/, "noValidate בלי ולידציה חלופית מחמיר את המצב");
  });

  it("שגיאות מוצגות בסיכום נגיש", () => {
    assert.match(source, /<ErrorSummary errors=\{leadErrors\}/);
  });

  it("כל שדה מקבל aria-invalid ו-aria-describedby", () => {
    assert.match(source, /"aria-invalid": Boolean\(error\)/);
    assert.match(source, /"aria-describedby": error \? errorId : undefined/);
  });

  it("הודעות השגיאה בעברית ומסבירות כיצד לתקן", () => {
    // QA-035: ההודעות עברו למילון הכרטיס, שהוא עכשיו מקור האמת שלהן.
    const he = cardStrings("he");
    assert.ok(he.invalidEmail("אימייל").includes("לדוגמה: name@example.com"));
    assert.ok(he.invalidPhone("טלפון").includes("יש להזין מספר מלא"));
  });

  it("המיקוד עובר לסיכום אחרי כשל, מתוך useEffect", () => {
    assert.match(source, /if \(focusLeadSummary > 0\) focusErrorSummary\(\)/);
  });
});

describe("REQ-001 — כשל אינו מאפס את הטופס", () => {
  it("טופס הלידים אינו קורא reset בכשל", () => {
    const source = read("src/components/card/public-card-client.tsx");
    const failureBlock = source.slice(source.indexOf('setLeadState("error")'));
    assert.doesNotMatch(failureBlock.slice(0, 400), /form\.reset\(\)/, "איפוס בכשל מוחק את עבודת המשתמש");
  });

  it("ההודעה מבהירה שהפרטים נשמרו", () => {
    assert.ok(cardStrings("he").genericError.includes("הפרטים שהזנת נשארו בטופס"));
  });
});

describe("REQ-003 — שגיאת הרשמה אינה מוחקת את השם", () => {
  it("פעולת השרת מחזירה את הערכים שהוזנו", () => {
    const source = read("src/app/(auth)/actions.ts");
    assert.match(source, /values\?: \{ fullName\?: string; email\?: string \}/);
    assert.match(source, /values: \{ fullName, email \}/);
  });

  it("סיסמאות אינן חוזרות ללקוח", () => {
    const source = read("src/app/(auth)/actions.ts");
    assert.doesNotMatch(source, /values: \{[^}]*password/i, "אסור להחזיר סיסמה ללקוח");
  });

  it("הטופס מזריק את הערך חזרה", () => {
    const source = read("src/components/auth/auth-form.tsx");
    assert.match(source, /defaultValue=\{keptValue\(signupState, "fullName"\)\}/);
    assert.match(source, /defaultValue=\{keptValue\(signupState, "email"\)\}/);
  });
});

describe("רגרסיה — הגיבוי בקוד אינו עוקף הסרת פרסום", () => {
  it("שורה שאינה מפורסמת מחזירה null גם עבור סלאג ההדגמה", () => {
    const source = read("src/lib/data.ts");
    assert.match(source, /if \(data\.is_published !== true\) return null;/,
      "בלי הבדיקה הזו, הסרת פרסום מכרטיס התצוגה לא מסירה אותו מהאוויר");
  });

  it("הגיבוי חל רק כשאין שורה במסד", () => {
    const source = read("src/lib/data.ts");
    assert.match(source, /if \(!data\) return slug === demoCard\.slug \? demoCard : null;/);
  });
});
