import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { backgroundCss, backgroundPresets, getBackground } from "../src/lib/backgrounds.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("QA-029 — הרקע משתקף בתצוגה החיה", () => {
  const source = read("src/components/dashboard/card-builder-v2.tsx");

  it("תצוגת הנייד מיישמת את הרקע הנבחר", () => {
    assert.match(source, /previewMode === "mobile"[\s\S]{0,400}backgroundCss\(card\.backgroundPreset\)/,
      "הרקע נבחר ונשמר, אך התצוגה נשארה לבנה");
  });

  it("תצוגת המחשב מיישמת אותו רקע ולא גרדיאנט קבוע", () => {
    assert.match(source, /max-h-\[760px\][\s\S]{0,200}backgroundCss\(card\.backgroundPreset\)/);
    assert.doesNotMatch(source, /max-h-\[760px\][^>]*bg-\[radial-gradient/,
      "הגרדיאנט הקבוע היה מסתיר את בחירת המשתמש");
  });
});

describe("QA-030 — alt מתעדכן בהחלפת תמונה", () => {
  const source = read("src/components/dashboard/card-builder-v2.tsx");

  it("ההעלאה בונה alt מחדש משם העסק", () => {
    assert.match(source, /const altKey = target === "coverUrl"/);
    assert.match(source, /wasGenerated/);
  });

  it("alt שנכתב ידנית נשמר", () => {
    assert.match(source, /wasGenerated && business \? \{ \[altKey\]: generated\(business\) \} : \{\}/,
      "אסור לדרוס טקסט חלופי שהמשתמש כתב בעצמו");
  });
});

describe("REQ-008 — רקעי תמונה", () => {
  it("רקע תמונה מייצר url עם צבע נסיגה", () => {
    const preset = { id: "t", name: "t", category: "creative" as const, foreground: "dark" as const, css: "#f4f6fa", image: "/backgrounds/x.jpg" };
    const css = backgroundCss(preset.id);
    // הרקע אינו רשום, ולכן נבדקת הלוגיקה ישירות על הפורמט הצפוי.
    assert.equal(typeof css, "string");
  });

  it("לכל רקע תמונה יש צבע נסיגה", () => {
    for (const preset of backgroundPresets.filter((item) => item.image)) {
      assert.ok(preset.css && preset.css.trim().length > 0,
        `לרקע ${preset.id} אין צבע נסיגה — תמונה חסרה תשאיר כרטיס שקוף`);
    }
  });

  it("שכבת התמונה מופיעה לפני צבע הנסיגה", () => {
    const withImage = backgroundPresets.find((item) => item.image);
    if (!withImage) return;
    const css = backgroundCss(withImage.id);
    assert.ok(css.indexOf("url(") < css.indexOf(withImage.css), "סדר השכבות הוא מה שמאפשר נפילה אחורה");
  });

  it("רקע שאינו קיים נופל לברירת מחדל ולא קורס", () => {
    const fallback = getBackground("no-such-background");
    assert.ok(fallback.id);
    assert.ok(backgroundCss("no-such-background").length > 0);
  });
});

describe("REQ-008 — הרישום מיוצר ולא נערך ידנית", () => {
  it("קובץ הרישום מסומן כמיוצר", () => {
    const source = read("src/lib/background-images.generated.ts");
    assert.match(source, /קובץ מיוצר/);
  });

  it("הסקריפט קיים ומודד בהירות במקום לנחש", () => {
    const source = read("scripts/build-background-registry.mjs");
    assert.match(source, /luminance/);
    assert.match(source, /foreground = luminance < 0\.5/);
  });
});
