import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  defaultContactFormFields,
  hasUsableContactForm,
  normalizeContactFormFields,
  visibleFields,
} from "../src/lib/contact-form.ts";
import { normalizeSlug, isSlugShapeValid, suggestSlugs } from "../src/lib/slug.ts";
import { HONEYPOT_FIELD, looksLikeBot } from "../src/lib/honeypot.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("QA-008 / QA-013 — טופס הלידים", () => {
  it("מערך ריק נופל לברירת מחדל", () => {
    /*
     * סיבת השורש המדויקת: `arrayValue` נפל לברירת מחדל רק כשהערך אינו
     * מערך, וברירת המחדל בעמודה היא '[]'. מערך ריק הוא מערך, ולכן
     * הטופס עלה בלי שום שדה — בלי שגיאה ובלי לוג.
     */
    assert.equal(normalizeContactFormFields([]).length, 4);
    assert.equal(normalizeContactFormFields(null).length, 4);
    assert.equal(normalizeContactFormFields(undefined).length, 4);
    assert.equal(normalizeContactFormFields("not-an-array").length, 4);
  });

  it("רשימה שכל שדותיה פסולים נופלת גם היא", () => {
    // שדה בלי תווית אינו שדה; רשימה כזו שקולה לריקה.
    assert.equal(normalizeContactFormFields([{ id: "a", label: "" }, { label: "   " }]).length, 4);
  });

  it("שדות תקינים נשמרים כפי שהם", () => {
    const custom = [{ id: "x", label: "שם החברה", type: "text", required: true }];
    const result = normalizeContactFormFields(custom);
    assert.equal(result.length, 1);
    assert.equal(result[0].label, "שם החברה");
  });

  it("היעדר enabled פירושו מוצג", () => {
    // כרטיס שנשמר לפני התוספת אינו מאבד שדות.
    const result = normalizeContactFormFields([{ id: "a", label: "שם", type: "text", required: true }]);
    assert.equal(result[0].enabled, true);
    assert.equal(visibleFields(result).length, 1);
  });

  it("שדה מוסתר אינו מוצג", () => {
    const fields = normalizeContactFormFields([
      { id: "a", label: "שם", type: "text", required: true, enabled: true },
      { id: "b", label: "פקס", type: "text", required: false, enabled: false },
    ]);
    assert.equal(fields.length, 2);
    assert.equal(visibleFields(fields).length, 1);
  });

  it("טופס עם תיבת סימון בלבד אינו שמיש", () => {
    // אי אפשר להשאיר פרטים בטופס שאין בו מה למלא.
    assert.equal(hasUsableContactForm([{ id: "c", label: "אישור", type: "checkbox", required: true, enabled: true }]), false);
    assert.equal(hasUsableContactForm(defaultContactFormFields()), true);
  });

  it("טופס שכל שדותיו מוסתרים אינו שמיש", () => {
    const hidden = defaultContactFormFields().map((field) => ({ ...field, enabled: false }));
    assert.equal(hasUsableContactForm(hidden), false);
  });

  it("הפרסום נחסם בשלוש שכבות", () => {
    assert.ok(read("src/components/dashboard/card-builder-v2.tsx").includes("formUsable"), "אזהרה בממשק");
    assert.ok(read("src/app/api/cards/route.ts").includes("hasUsableContactForm(parsed.data.contactFormFields)"), "חסימה בשרת");
    assert.ok(read("supabase/migrations/025_contact_form_backfill.sql").includes("PLAN_LIMIT:contactForm"), "חסימה במסד");
  });

  it("המיגרציה ממלאת רק שורות ריקות", () => {
    // דריסת בחירה מודעת של בעל העסק גרועה מהתקלה עצמה.
    const migration = read("supabase/migrations/025_contact_form_backfill.sql");
    assert.ok(migration.includes("jsonb_array_length(contact_form_fields) = 0"));
    assert.ok(migration.includes("Rollback"));
  });

  it("כשל שמירה מחזיר מזהה ואינו מאפס", () => {
    const route = read("src/app/api/leads/route.ts");
    assert.ok(route.includes("errorId"));
    assert.ok(route.includes("הפרטים נשארו בטופס"));
  });
});

describe("QA-006 — מלכודת הספאם", () => {
  it("רק ערך שהוזן נחשב לבוט", () => {
    assert.equal(looksLikeBot(""), false);
    assert.equal(looksLikeBot("   "), false);
    assert.equal(looksLikeBot(undefined), false);
    assert.equal(looksLikeBot(null), false);
    assert.equal(looksLikeBot("bot"), true);
  });

  it("השם אינו אסימון autofill", () => {
    assert.ok(!["website", "company", "url", "organization"].includes(HONEYPOT_FIELD));
  });

  it("הסכמה אינה פוסלת ערך בשדה המלכודת", () => {
    /*
     * קודם הוגדר `max(0)`, ולכן דפדפן שמילא את השדה גרם לשגיאת ולידציה
     * גנרית — הפנייה נדחתה בלי שאיש יבין למה.
     */
    const validation = read("src/lib/validation.ts");
    assert.ok(!validation.includes("website: z.string().max(0)"));
    assert.ok(validation.includes("[HONEYPOT_FIELD]: z.string().max(200).optional()"));
  });
});

describe("NEW-006 — כפילות כתובת", () => {
  it("הנרמול סוגר את דרכי העקיפה", () => {
    assert.equal(normalizeSlug("My-Card"), "my-card");
    assert.equal(normalizeSlug("  my card  "), "my-card");
    assert.equal(normalizeSlug("my___card"), "my-card");
    assert.equal(normalizeSlug("my--card"), "my-card");
    assert.equal(normalizeSlug("-my-card-"), "my-card");
    assert.equal(normalizeSlug("my.card"), "my-card");
    assert.equal(normalizeSlug("café"), "cafe");
  });

  it("מבנה פסול נדחה", () => {
    assert.equal(isSlugShapeValid("ab"), false);
    assert.equal(isSlugShapeValid("---"), false);
    assert.equal(isSlugShapeValid("abc"), true);
  });

  it("החלופות מבוססות על שם העסק", () => {
    // "my-card-2" אינו אומר דבר ללקוח; "studio-il" כן.
    const options = suggestSlugs("Studio Tel Aviv", "studio-tel-aviv");
    assert.ok(options.length > 0);
    assert.ok(options.every((option) => option !== "studio-tel-aviv"));
    assert.ok(options[0].startsWith("studio-tel-aviv"));
  });

  it("הייחודיות אינה תלוית רישיות במסד", () => {
    // אכיפה שנשענת על שכבה אחת אינה אכיפה.
    const migration = read("supabase/migrations/026_slug_uniqueness.sql");
    assert.ok(migration.includes("unique index"));
    assert.ok(migration.includes("lower(slug)"));
    assert.ok(migration.includes("Rollback"));
  });

  it("הכתובת של הכרטיס עצמו אינה תפוסה עבורו", () => {
    const route = read("src/app/api/cards/slug-check/route.ts");
    assert.ok(route.includes("data.id !== parsed.data.cardId"));
  });

  it("הבדיקה מוגנת בקצב ודורשת התחברות", () => {
    const route = read("src/app/api/cards/slug-check/route.ts");
    assert.ok(route.includes("נדרשת התחברות"));
    assert.ok(route.includes("rateLimit("));
  });
});

describe("NEW-007 — מעבר בין כרטיסים", () => {
  it("העורך מורכב מחדש בהחלפת כרטיס", () => {
    /*
     * סיבת השורש: `useState(initialCard)` מתעלם מה-prop אחרי ההרכבה
     * הראשונה. העורך נשאר עם נתוני הכרטיס הקודם — והשמירה שלחה את
     * המזהה הישן, כלומר עריכת כרטיס ב׳ נכתבה לכרטיס א׳.
     */
    const page = read("src/app/dashboard/card/page.tsx");
    assert.ok(page.includes("key={card.id}"), "בלי key הרכיב אינו מתאפס");
  });

  it("כל קישור פנימי נושא את הכרטיס הנבחר", () => {
    const dashboard = read("src/app/dashboard/page.tsx");
    assert.ok(!dashboard.includes('href="/dashboard/card"'), "קישור בלי כרטיס מאבד את הבחירה");
    assert.ok(dashboard.includes("card=${selectedCardId}"));
  });

  it("הנתונים נשלפים לפי הכרטיס הנבחר", () => {
    const data = read("src/lib/data.ts");
    assert.ok(data.includes("getAnalyticsSummary(viewer: Viewer, cardId?: string)"));
    assert.ok(data.includes("getLeads(viewer: Viewer, cardId?: string)"));
    // הבעלות נבדקת בשרת; מזהה מהלקוח אינו מספיק.
    assert.ok(data.includes('.eq("user_id", viewer.id)'));
  });
});
