import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { countDigits, isEmailLike } from "../src/lib/email-format.ts";
import { cardDir, cardLocale, cardStrings, toCardLanguage } from "../src/lib/card-i18n.ts";
import { consentCategories, CONSENT_VERSION } from "../src/lib/consent.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("אימות אימייל — מקור אמת יחיד", () => {
  it("כתובות שנדחו בגלל הרגקס השבור מתקבלות", () => {
    /*
     * זו הבדיקה שמגנה על התקלה שהתגלתה: `[^s@]` במקום `[^\s@]` פסל כל
     * כתובת שמכילה את האות s. לידים אמיתיים אבדו בלי שום שגיאה בלוג.
     */
    for (const value of [
      "israel@gmail.com",
      "shira@gmail.com",
      "moshe@walla.co.il",
      "yossi.cohen@some-domain.co.il",
      "sales@shop.example",
    ]) {
      assert.equal(isEmailLike(value), true, value);
    }
  });

  it("כתובות פסולות עדיין נדחות", () => {
    for (const value of [
      "",
      "   ",
      "not-an-email",
      "a@b",
      "a@b.c",
      "@example.com",
      "user@",
      "user@@example.com",
      "user name@example.com",
      "user@exa mple.com",
      "user@example..com",
      "user@.com",
      "user@example.",
    ]) {
      assert.equal(isEmailLike(value), false, JSON.stringify(value));
    }
  });

  it("רווחים בקצוות אינם פוסלים", () => {
    assert.equal(isEmailLike("  dan@example.com  "), true);
  });

  it("אין יותר עותקים של הרגקס בקוד", () => {
    // שלושה עותקים, אחד פגום — זו הסיבה שהבדיקה הזו קיימת.
    for (const path of [
      "src/components/card/public-card-client.tsx",
      "src/components/contact/contact-form.tsx",
      "src/lib/auth-schema.ts",
    ]) {
      assert.ok(!read(path).includes("s@]+@"), `${path} מחזיק עותק משלו`);
      assert.ok(read(path).includes("isEmailLike"), `${path} אינו משתמש במקור המשותף`);
    }
  });
});

describe("ספירת ספרות", () => {
  it("סופרת ספרות בלבד", () => {
    // `/D/` במקום `/\D/` ספר מקפים ורווחים כספרות.
    assert.equal(countDigits("050-123-4567"), 10);
    assert.equal(countDigits("1-2-3-4-5"), 5);
    assert.equal(countDigits("+972 50 123 4567"), 12);
    assert.equal(countDigits(""), 0);
    assert.equal(countDigits(null), 0);
  });

  it("מספר טלפון קצר מדי נפסל", () => {
    assert.ok(countDigits("1-2-3-4-5") < 9);
  });
});

describe("QA-035 — שפת הכרטיס", () => {
  it("כיוון ו-locale נגזרים מהשפה", () => {
    assert.equal(cardDir("he"), "rtl");
    assert.equal(cardDir("en"), "ltr");
    assert.equal(cardLocale("he"), "he_IL");
    assert.equal(cardLocale("en"), "en_US");
  });

  it("קלט לא מוכר נופל לעברית", () => {
    assert.equal(toCardLanguage("en"), "en");
    assert.equal(toCardLanguage("he"), "he");
    assert.equal(toCardLanguage("EN"), "he");
    assert.equal(toCardLanguage(undefined), "he");
    assert.equal(toCardLanguage(null), "he");
  });

  it("לשתי השפות יש את אותן מחרוזות", () => {
    // מפתח שקיים בעברית ולא באנגלית היה מרנדר undefined בכרטיס חי.
    const he = cardStrings("he");
    const en = cardStrings("en");
    assert.deepEqual(Object.keys(he).sort(), Object.keys(en).sort());
    for (const key of Object.keys(he)) {
      const value = en[key as keyof typeof en];
      assert.ok(value !== undefined && value !== null, `חסר ${key} באנגלית`);
      if (typeof value === "string") assert.ok(value.length > 0, `${key} ריק באנגלית`);
    }
  });

  it("אין מחרוזת עברית שנשארה בתוך המילון האנגלי", () => {
    const en = cardStrings("en");
    for (const [key, value] of Object.entries(en)) {
      const text = typeof value === "function" ? value("X") : String(value);
      // טווח האותיות העבריות.
      const hasHebrew = Array.from(text).some((char) => {
        const code = char.charCodeAt(0);
        return code >= 0x05d0 && code <= 0x05ea;
      });
      assert.equal(hasHebrew, false, `${key} מכיל עברית: ${text}`);
    }
  });

  it("השפה עוברת דרך כל שכבות הנתונים", () => {
    assert.ok(read("src/lib/types.ts").includes('language: "he" | "en"'));
    assert.ok(read("src/lib/card-row.ts").includes("language: card.language"));
    assert.ok(read("src/lib/data.ts").includes('row.language === "en"'));
    assert.ok(read("src/lib/validation.ts").includes('language: z.enum(["he", "en"])'));
  });

  it("הכיוון מוצהר על הכרטיס הציבורי", () => {
    const client = read("src/components/card/public-card-client.tsx");
    assert.ok(client.includes("lang={language} dir={dir}"));
  });

  it("ה-locale ב-SEO אינו קבוע", () => {
    const page = read("src/app/[slug]/page.tsx");
    assert.ok(!page.includes('locale: "he_IL"'), "locale קבוע מצהיר עברית גם בכרטיס אנגלי");
    assert.ok(page.includes("cardLocale(toCardLanguage(card.language))"));
  });

  it("המיגרציה מגבילה לערכים מוכרים", () => {
    const migration = read("supabase/migrations/018_card_language.sql");
    assert.ok(migration.includes("check (language in ('he', 'en'))"));
    assert.ok(migration.includes("default 'he'"));
    assert.ok(migration.includes("Rollback"));
  });
});

describe("REQ-004 — הסכמת עוגיות לפי קטגוריות", () => {
  it("שתי קטגוריות שניתן לדחות, מעבר להכרחי", () => {
    assert.deepEqual(consentCategories.map((category) => category.id), ["analytics", "marketing"]);
  });

  it("אנליטיקה ושיווק נטענים בנפרד", () => {
    /*
     * קודם לכן פיקסל שיווקי נטען על סמך הסכמה למדידה — שתי מטרות
     * שונות תחת לחיצה אחת.
     */
    const tracking = read("src/components/card/third-party-tracking.tsx");
    assert.ok(tracking.includes('hasConsent("analytics")'));
    assert.ok(tracking.includes('hasConsent("marketing")'));
    assert.ok(tracking.includes("loadMarketing"));
    assert.ok(!tracking.includes('localStorage.getItem("cookie-consent")'));
  });

  it("המדידה הפנימית כפופה לאותה הסכמה", () => {
    const client = read("src/components/card/public-card-client.tsx");
    assert.ok(client.includes('hasConsent("analytics")'));
    assert.ok(!client.includes('"cookie-consent"'));
  });

  it("דחייה וקבלה מוצגות באותה בולטות", () => {
    // כפתור דחייה חלש מכפתור קבלה נפסל כ"דפוס אפל".
    const banner = read("src/components/cookie-consent.tsx");
    assert.ok(banner.includes("דחיית הכול"));
    assert.ok(banner.includes("קבלת הכול"));
    assert.ok(banner.includes("ניהול מפורט"));
  });

  it("גרסת החלונית מאלצת בחירה מחדש", () => {
    assert.equal(CONSENT_VERSION, "2");
    assert.ok(read("src/lib/consent.ts").includes("parsed.version === CONSENT_VERSION"));
  });

  it("גישה לאחסון עטופה, כי היא זורקת בדפדפנים שחוסמים", () => {
    const consent = read("src/lib/consent.ts");
    const tryCount = consent.split("try {").length - 1;
    assert.ok(tryCount >= 4, `רק ${tryCount} עטיפות try`);
  });
});

describe("REQ-017 — כפתור חזרה חכם", () => {
  const button = read("src/components/ui/back-button.tsx");

  it("אינו נשען על history.back בלבד", () => {
    // בכניסה ישירה אין היסטוריה, ו-back היה מוציא מהאתר.
    assert.ok(button.includes("document.referrer"));
    assert.ok(button.includes("window.history.length > 1"));
    assert.ok(button.includes("router.push(fallback)"));
  });

  it("מופיע בכל המסכים הפנימיים", () => {
    for (const path of [
      "src/app/dashboard/leads/page.tsx",
      "src/app/dashboard/analytics/page.tsx",
      "src/app/dashboard/settings/page.tsx",
      "src/components/dashboard/card-builder-v2.tsx",
    ]) {
      assert.ok(read(path).includes("<BackButton"), `${path} ללא כפתור חזרה`);
    }
  });

  it("כולל aria-label", () => {
    assert.ok(button.includes("aria-label="));
    assert.ok(read("src/app/dashboard/leads/page.tsx").includes("ariaLabel="));
  });

  it("יציאה מהעורך שומרת את הטיוטה", () => {
    const builder = read("src/components/dashboard/card-builder-v2.tsx");
    assert.ok(builder.includes("beforeNavigate="));
    assert.ok(builder.includes("dirtyRef.current"));
  });
});

describe("REQ-024 — כפתור התקשרות אחד", () => {
  const fab = read("src/components/card/contact-fab.tsx");

  it("נגיש במקלדת", () => {
    assert.ok(fab.includes("aria-expanded={open}"));
    assert.ok(fab.includes("aria-controls="));
    assert.ok(fab.includes('event.key !== "Escape"'));
    assert.ok(fab.includes("toggleRef.current?.focus()"));
  });

  it("מכבד safe area", () => {
    assert.ok(fab.includes("env(safe-area-inset-bottom)"));
  });

  it("אינו מציג ערוץ בלי יעד תקין", () => {
    // קישור שבור גרוע מהיעדר כפתור.
    assert.ok(fab.includes("usableActions(card)"));
    assert.ok(fab.includes("Boolean(actionHref(action, card))"));
    assert.ok(fab.includes("if (!actions.length) return null"));
  });

  it("מותקן בכרטיס הציבורי ומפנה לו מקום", () => {
    const client = read("src/components/card/public-card-client.tsx");
    assert.ok(client.includes("<ContactFab card={card}"));
    assert.ok(client.includes("pb-24"), "הפוטר חייב להשאיר מקום לכפתור הצף");
  });
});
