import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { demoCard } from "../src/lib/demo-data.ts";
import { planLimits } from "../src/lib/plan-access.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

/**
 * הקובץ בלי הערות.
 *
 * הערה שמסבירה למה ערך מסוים הוסר מכילה בהכרח את הערך עצמו, ולכן
 * חיפוש בקובץ שלם נכשל דווקא כשהקוד נכון. נכתב כסריקת תווים ולא
 * ברגקס — מחלקות תווים עם escapes נשברו בפרויקט הזה יותר מפעם אחת.
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

describe("QA-002 — אין נתונים ועדויות שלא נמדדו", () => {
  const source = code("src/components/marketing/testimonials.tsx");

  it("המספרים שהומצאו הוסרו", () => {
    /*
     * "1,200+ כרטיסים פעילים", "94% ממשיכים" ו-"15 דק׳" הומצאו לצורך
     * העיצוב. הצגת נתון מסחרי שלא נמדד היא הטעיה, לא בעיית תוכן.
     */
    for (const fabricated of ["1200", "1,200", "94", "כרטיסים פעילים", "ממשיכים אחרי ההתנסות"]) {
      assert.ok(!source.includes(fabricated), `נשאר נתון מומצא: ${fabricated}`);
    }
  });

  it("אין עדויות עם שמות שאינם לקוחות", () => {
    for (const name of ["נועה כהן", "איתי ברק", "מאיה עזר", "רוני שלו"]) {
      assert.ok(!source.includes(name), `נשארה עדות בדויה: ${name}`);
    }
    assert.ok(source.includes("const testimonials: Testimonial[] = []"));
  });

  it("הנתונים המוצגים נגזרים מהמוצר", () => {
    // נתון שאי אפשר לגזור — אין לו מקום במקטע הזה.
    assert.ok(source.includes("backgroundPresets.length"));
    assert.ok(source.includes("TRIAL_DAYS"));
  });

  it("הקרוסלה מוצגת רק כשיש המלצות", () => {
    assert.ok(source.includes("{testimonials.length > 0 && ("));
  });

  it("הרישיון השיווקי בתקנון אינו מכשיר המצאה", () => {
    const terms = read("src/components/legal/documents/terms-body.tsx");
    assert.ok(terms.includes("רישיון לא בלעדי"), "חסר הרישיון השיווקי");
    assert.ok(terms.includes("ללא צורך באישור נפרד"), "הרישיון אינו רחב כפי שנדרש");
    // הסייג שמבדיל בין שימוש בהמלצה אמיתית לבין המצאתה.
    assert.ok(terms.includes("המלצה שלא מסרת בפועל"));
    // זכות הסרה — בלעדיה רישיון בלתי חוזר בחוזה אחיד חשוף לפסילה.
    assert.ok(terms.includes("זכות הסרה"));
  });
});

describe("QA-017 — אין מגמה שלא נמדדה", () => {
  const source = code("src/app/dashboard/page.tsx");

  it("אחוזי המגמה הקבועים הוסרו", () => {
    for (const fake of ['"+18%"', '"+12%"', '"+7"', '"+9%"']) {
      assert.ok(!source.includes(fake), `נשארה מגמה מומצאת: ${fake}`);
    }
  });

  it("חשבון ללא נתונים מקבל הסבר ולא אחוז", () => {
    assert.ok(source.includes("אין מספיק נתונים"));
    assert.ok(source.includes("raw === 0"));
  });
});

describe("QA-010 — המסלול הנבחר מוצג בהרשמה", () => {
  const source = read("src/components/auth/auth-form.tsx");

  it("המסלול נשמר וגם מוצג", () => {
    assert.ok(source.includes('<input type="hidden" name="plan" value={plan} />'), "הערך חייב להישמר");
    assert.ok(source.includes("selectedPlan"), "הערך חייב גם להיות מוצג");
    assert.ok(source.includes("נבחר מסלול"));
  });

  it("מוצג הסכום לפי מחזור החיוב שנבחר", () => {
    assert.ok(source.includes("cycleAmount(selectedPlan.price, cycle)"));
  });
});

describe("QA-011 / QA-012 — שיתוף ברשתות", () => {
  it("קיימת תמונת שיתוף ממותגת", () => {
    assert.ok(fs.existsSync("src/app/opengraph-image.tsx"));
    const image = read("src/app/opengraph-image.tsx");
    assert.ok(image.includes("export const size = { width: 1200, height: 630 }"));
  });

  it("התמונה מוגדרת במפורש בכל עמוד", () => {
    /*
     * QA-011: קונבנציית הקבצים חלה על מקטע הנתיב בלבד, ועמוד שמגדיר
     * openGraph משלו דורס אותה יחד עם התמונה.
     */
    for (const path of ["src/app/layout.tsx", "src/app/pricing/page.tsx", "src/app/contact/page.tsx"]) {
      assert.ok(read(path).includes("images: [ogImage]"), `${path} ללא תמונת שיתוף`);
    }
  });

  it("כרטיס בלי תמונה מקבל את תמונת המותג", () => {
    const page = read("src/app/[slug]/page.tsx");
    assert.ok(page.includes(": [ogImage];"), "כרטיס בלי תמונה יצא לרשתות בלי תמונה כלל");
  });

  it("לעמודי המשנה יש מטא ייעודי ולא הגנרי", () => {
    assert.ok(read("src/app/pricing/page.tsx").includes("openGraph: { title: \"המסלול שמתאים לעסק שלך\""));
    assert.ok(read("src/app/contact/page.tsx").includes("openGraph: { title: \"מדברים איתנו\""));
  });
});

describe("REQ-007 — אין פרטי דמה בהדגמה", () => {
  it("כרטיס ההדגמה אינו מפנה ל-example.com", () => {
    // פעולה שנראית אמיתית ואינה מגיעה לשום מקום היא בדיוק מה שנאסר.
    const source = read("src/lib/demo-data.ts");
    assert.ok(!source.includes("example.com"), "נשארו יעדי דמה");
  });

  it("פרטי הקשר בהדגמה אמיתיים", () => {
    assert.ok(demoCard.email.includes("@"));
    assert.ok(!demoCard.email.includes("example"));
    assert.ok(!demoCard.website.includes("example"));
  });

  it("מוצגים שלושה כרטיסים נפרדים ולא אותו כרטיס שלוש פעמים", () => {
    /*
     * זו הייתה הפרשנות הלא נכונה הראשונה: דף הבית הציג את demoCard
     * בגיבור, במגרש המשחקים ובהדגמה החיה — שלוש הופעות של כרטיס אחד.
     */
    const gallery = read("src/components/marketing/showcase-gallery.tsx");
    for (const slug of ["noa-design", "naimly-studio", "naimly-consult"]) {
      assert.ok(gallery.includes(slug), `חסר ${slug}`);
    }
    assert.ok(read("src/app/page.tsx").includes("<ShowcaseGallery />"));
  });

  it("המחירים בכרטיס התצוגה נגזרים ואינם מוקלדים", () => {
    /*
     * הכרטיס הציבורי פרסם "פרימיום 119 ₪ ותמיכה מועדפת" אחרי שהמחירון
     * השתנה, כי המספר הוקלד בסקריפט הזריעה.
     */
    const seed = code("scripts/seed-showcase-cards.mjs");
    assert.ok(seed.includes("planServices"), "המחירים חייבים להיגזר מ-plans");
    assert.ok(!seed.includes("119"), "נשאר מחיר מוקלד");
    assert.ok(!seed.includes("תמיכה מועדפת"), "נשארה יכולת שהוסרה");
  });
});

describe("REQ-016 — מסמכים בחלונית", () => {
  const dialog = read("src/components/legal/legal-dialog.tsx");

  it("החלונית נגישה", () => {
    assert.ok(dialog.includes('role="dialog"'));
    assert.ok(dialog.includes('aria-modal="true"'));
    assert.ok(dialog.includes("aria-labelledby={titleId}"));
  });

  it("Escape סוגר והמיקוד חוזר", () => {
    assert.ok(dialog.includes('event.key === "Escape"'));
    assert.ok(dialog.includes("closeRef.current?.focus()"));
  });

  it("המיקוד נלכד בתוך החלונית", () => {
    // בלי לכידה Tab יוצא לטופס שמאחור, והמשתמש מאבד את הדיאלוג.
    assert.ok(dialog.includes('event.key !== "Tab"'));
    assert.ok(dialog.includes("event.preventDefault()"));
  });

  it("התוכן נגלל", () => {
    assert.ok(dialog.includes("overflow-y-auto"));
  });

  it("הטפסים אינם מנווטים יותר בלשונית חדשה", () => {
    for (const path of ["src/components/onboarding/plan-choice.tsx", "src/components/checkout-button.tsx"]) {
      const source = read(path);
      assert.ok(source.includes("<LegalLink docId={doc.id}>"), `${path} אינו משתמש בחלונית`);
      assert.ok(!source.includes('href={doc.href} target="_blank"'), `${path} עדיין מנווט החוצה`);
    }
  });

  it("אין שתי גרסאות של אותו נוסח", () => {
    // התוכן מיובא מאותם רכיבים שמרנדרים את העמוד המלא.
    assert.ok(dialog.includes("@/components/legal/documents/terms-body"));
    assert.ok(read("src/app/legal/terms/page.tsx").includes("<TermsBody />"));
  });
});

describe("REQ-012 — תיעוד ההסכמה מלא וניתן להפקה", () => {
  const migration = read("supabase/migrations/020_acceptance_evidence.sql");

  it("נשמרים plan_id ומזהה פעולה", () => {
    assert.ok(migration.includes("add column if not exists plan_id text"));
    assert.ok(migration.includes("add column if not exists reference text"));
    assert.ok(migration.includes("Rollback"));
  });

  it("המסלול נרשם בכל שלושת המסלולים", () => {
    assert.ok(migration.includes("target_plan"), "בחירת מסלול בתשלום");
    assert.ok(migration.includes("current_plan"), "אישור מחדש");
    assert.ok(migration.includes("'trial'"), "בחירת התנסות");
  });

  it("הלקוח יכול להפיק את התיעוד בעצמו", () => {
    const route = read("src/app/api/legal/my-acceptance/route.ts");
    assert.ok(route.includes('audience: "customer"'));
    assert.ok(route.includes("to: viewer.email"));
    // הקריאה עוברת דרך ה-client של המשתמש, ולכן RLS מגבילה אותה אליו.
    assert.ok(route.includes("createSupabaseServerClient"));
    assert.ok(route.includes('.eq("user_id", viewer.id)'));
  });

  it("האישור העצמי אינו מדווח על שליחה שלא קרתה", () => {
    assert.ok(read("src/app/api/legal/my-acceptance/route.ts").includes("if (!result.sent)"));
  });
});

describe("REQ-020 — שמירת ראיות במדיניות", () => {
  const policy = read("src/components/legal/documents/acceptable-use-body.tsx");

  it("מוגדרים תהליך בדיקה, ראיות, תקופה וייעוד", () => {
    assert.ok(policy.includes("תהליך הבדיקה"));
    assert.ok(policy.includes("שמירת ראיות"));
    assert.ok(policy.includes("שנתיים"));
    assert.ok(policy.includes("ערעור"));
  });

  it("הראיות מוגבלות למטרה", () => {
    // ראיה שנשמרת בלי הגבלת מטרה היא מאגר מידע ללא בסיס.
    assert.ok(policy.includes("ולא לכל מטרה אחרת"));
  });
});

describe("REQ-011 — כרטיס נוסף", () => {
  it("פרימיום כולל שני כרטיסים והשאר אחד", () => {
    assert.equal(planLimits("premium").cards, 2);
    assert.equal(planLimits("pro").cards, 1);
    assert.equal(planLimits("basic").cards, 1);
    assert.equal(planLimits("trial").cards, 1);
  });

  it("קיים בורר כרטיסים", () => {
    const switcher = read("src/components/dashboard/card-switcher.tsx");
    assert.ok(switcher.includes("aria-pressed={active}"));
    // הבחירה נשמרת ב-URL כדי שרענון וכפתור חזרה יחזירו את אותו כרטיס.
    assert.ok(switcher.includes("/dashboard/card?card="));
  });

  it("היצירה נחסמת במכסת המסלול", () => {
    const route = read("src/app/api/cards/new/route.ts");
    assert.ok(route.includes("existing >= limits.cards"));
    assert.ok(route.includes('feature: "cards"'));
  });

  it("הכרטיס הנערך מסונן לפי המשתמש", () => {
    // בלי התנאי הזה שינוי ה-URL היה חושף כרטיס של מישהו אחר.
    const data = read("src/lib/data.ts");
    assert.ok(data.includes('.eq("id", cardId)'));
    assert.ok(data.includes('.eq("user_id", viewer.id)'));
  });
});
