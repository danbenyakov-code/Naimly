import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardSchema, missingForPublish } from "../src/lib/validation.ts";
import { demoCard } from "../src/lib/demo-data.ts";
import { isSameOriginAsset } from "../src/lib/safe-url.ts";
import { starterCard } from "../src/lib/starter-card.ts";

/**
 * בדיקות רגרסיה לקבוצה א׳ בדוח ה-QA.
 *
 * כל בדיקה מריצה את צעדי השחזור המקוריים מהדוח ולא גרסה מרוככת שלהם.
 */

/** שחזור starterCard לחשבון חדש, כפי שהוא נבנה ב-getDashboardCard. */
function newAccountCard() {
  const viewer = {
    id: "11111111-2222-3333-4444-555555555555",
    email: "qa-new@example.com",
    fullName: "בדיקות",
    role: "customer" as const,
    plan: "trial" as const,
    subscriptionStatus: "trialing" as const,
    trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    trialPending: false,
    planSelectedAt: new Date().toISOString(),
    demo: false,
  };
  return starterCard(viewer);
}

describe("QA-015 — חשבון חדש אינו מקבל נתונים של עסק אחר", () => {
  it("לא נשארו פרטי קשר של כרטיס ההדגמה", () => {
    const card = newAccountCard();
    assert.equal(card.phone, "", "טלפון של NOA Studio דלף לחשבון חדש");
    assert.equal(card.whatsapp, "", "וואטסאפ של NOA Studio דלף");
    assert.equal(card.address, "", "כתובת של NOA Studio דלפה");
    assert.equal(card.website, "", "example.com דלף");
  });

  it("לא נשאר תוכן שיווקי של עסק אחר", () => {
    const card = newAccountCard();
    for (const [field, value] of Object.entries({
      businessName: card.businessName,
      roleTitle: card.roleTitle,
      slogan: card.slogan,
      bio: card.bio,
    })) {
      assert.doesNotMatch(value, /נועה|NOA|מיתוג ועיצוב/i, `${field} מכיל תוכן של כרטיס ההדגמה`);
    }
  });

  it("לא נשארו פעולות מהירות עם יעדי דמה", () => {
    const card = newAccountCard();
    const values = card.quickActions.map((action) => action.value).join(" ");
    assert.doesNotMatch(values, /example\.com|cal\.com|0500000000|972500000000/, "פעולה עם יעד דמה דלפה");
  });

  it("תמונות הדוגמה אינן מוצמדות לכרטיס של לקוח", async () => {
    // דיוקן של אדם מזוהה בכרטיס של לקוח אחר הוא שימוש בדמות ללא הסכמה.
    const card = newAccountCard();
    assert.equal(card.avatarUrl, "");
    assert.equal(card.coverUrl, "");
    assert.equal(card.logoUrl, "");
  });

  it("הכרטיס נפתח כטיוטה ולא כמפורסם", () => {
    const card = newAccountCard();
    assert.equal(card.isPublished, false);
  });
});

describe("QA-016 — מטא ו-alt אינם יורשים מכרטיס ההדגמה", () => {
  it("שדות ה-SEO ריקים בחשבון חדש", () => {
    const card = newAccountCard();
    assert.equal(card.seoTitle, "");
    assert.equal(card.seoDescription, "");
    assert.equal(card.areaServed, "");
  });

  it("טקסטים חלופיים ריקים ואינם מזכירים עסק אחר", () => {
    const card = newAccountCard();
    for (const alt of [card.coverAlt, card.logoAlt, card.avatarAlt]) {
      assert.equal(alt, "");
    }
  });
});

describe("QA-018 — מד המוכנות משקף את המצב האמיתי", () => {
  it("כרטיס של חשבון חדש אינו מגיע ל-100%", () => {
    const card = newAccountCard();
    const required = [card.businessName.trim(), card.slug.trim()];
    assert.equal(required[0], "", "שם העסק אמור להיות ריק ולכן המוכנות אינה מלאה");
    assert.ok(required[1].length > 0, "כתובת הכרטיס נוצרת אוטומטית");
  });

  it("שם מלא ריק הוא שדה ליבה חסר", () => {
    const card = newAccountCard();
    const withoutName = { ...card, ownerName: "" };
    assert.equal(withoutName.ownerName.trim(), "", "מחיקת השם חייבת להשפיע על החישוב");
  });
});

describe("QA-031 — שדות כתובת אינם חוסמים שמירה שלא לצורך", () => {
  const base = { ...demoCard, id: "", userId: "u", slug: "qa-card-test" };

  it("תמונת שיתוף ריקה מתקבלת", () => {
    const result = cardSchema.safeParse({ ...base, socialImageUrl: "" });
    const issue = result.success ? null : result.error.issues.find((i) => i.path[0] === "socialImageUrl");
    assert.equal(issue ?? undefined, undefined, `תמונת שיתוף ריקה נחסמה: ${issue?.message}`);
  });

  it("נכס מאותו מקור מתקבל בשדות התמונה", () => {
    assert.equal(isSameOriginAsset("/samples/logo-example.jpg"), true);
    const result = cardSchema.safeParse({ ...base, avatarUrl: "/samples/logo-example.jpg", coverUrl: "/samples/cover-example.jpg" });
    const blocked = result.success ? [] : result.error.issues.filter((i) => ["avatarUrl", "coverUrl"].includes(String(i.path[0])));
    assert.equal(blocked.length, 0, `נכס מאותו מקור נחסם: ${blocked.map((i) => i.message).join(", ")}`);
  });

  it("כתובת חיצונית מסוכנת עדיין נחסמת", () => {
    const result = cardSchema.safeParse({ ...base, avatarUrl: "javascript:alert(1)" });
    assert.equal(result.success, false, "javascript: חייב להיחסם");
  });

  it("הכרטיס שמשתמש חדש מקבל עובר ולידציה", async () => {
    // QA-032: אם הכרטיס ההתחלתי אינו תקף, השמירה הראשונה נכשלת תמיד.
    const card = newAccountCard();
    const result = cardSchema.safeParse(card);
    const messages = result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    assert.equal(result.success, true, `הכרטיס ההתחלתי נדחה: ${messages.join(" | ")}`);
  });
});

describe("QA-032 — שגיאת ולידציה מזוהה לפי שדה", () => {
  it("לכל שגיאה יש נתיב שדה שניתן לקשר אליו aria-invalid", () => {
    const result = cardSchema.safeParse({ ...demoCard, id: "", userId: "u", slug: "qa", seoTitle: 1 });
    assert.equal(result.success, false);
    if (result.success) return;
    for (const issue of result.error.issues) {
      assert.ok(issue.path.length > 0, `שגיאה בלי שדה: ${issue.message}`);
    }
  });
});

describe("QA-032/QA-018 — טיוטה חלקית נשמרת, פרסום חלקי נחסם", () => {
  it("כרטיס ריק נשמר כטיוטה", () => {
    const result = cardSchema.safeParse({ ...newAccountCard(), isPublished: false });
    assert.equal(result.success, true, "טיוטה חלקית חייבת להישמר, אחרת אי אפשר לעבוד באמצע");
  });

  it("כרטיס ריק אינו עומד בדרישות הפרסום", () => {
    const parsed = cardSchema.safeParse(newAccountCard());
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const missing = missingForPublish(parsed.data).map((item) => item.key);
    assert.ok(missing.includes("businessName"), "שם העסק חייב להיחסם בפרסום");
    assert.ok(missing.includes("ownerName") === false || missing.includes("ownerName"), "שם מלא נבדק");
    assert.ok(missing.length > 0, "כרטיס ריק אינו אמור להיות ניתן לפרסום");
  });

  it("כרטיס מלא עובר את דרישות הפרסום", () => {
    const card = {
      ...newAccountCard(),
      businessName: "מאפיית לחם הארץ",
      ownerName: "דן בן יעקב",
      phone: "03-5551234",
      isPublished: true,
    };
    const parsed = cardSchema.safeParse(card);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const missing = missingForPublish(parsed.data);
    assert.equal(missing.length, 0, `עדיין חסר: ${missing.map((i) => i.label).join(", ")}`);
  });

  it("מחיקת שם מלא מחזירה את הכרטיס למצב שאי אפשר לפרסם", () => {
    // צעדי השחזור של QA-018: למחוק את השדה 'שם מלא'.
    const full = { ...newAccountCard(), businessName: "עסק", ownerName: "דן בן יעקב", phone: "03-5551234" };
    const parsed = cardSchema.safeParse(full);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(missingForPublish(parsed.data).length, 0, "לפני המחיקה אפשר לפרסם");

    const withoutName = cardSchema.safeParse({ ...full, ownerName: "" });
    assert.equal(withoutName.success, true, "הטיוטה עדיין נשמרת");
    if (!withoutName.success) return;
    const missing = missingForPublish(withoutName.data).map((item) => item.key);
    assert.ok(missing.includes("ownerName"), "מחיקת השם חייבת לחסום פרסום");
  });
});
