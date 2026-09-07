import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  backgroundCategories,
  backgroundPresets,
  countByCategory,
  getBackground,
  isBackgroundId,
  searchBackgrounds,
} from "../src/lib/backgrounds.ts";
import { checkContrast, contrastRatio, readableTextColor } from "../src/lib/contrast.ts";

describe("ספריית רקעים", () => {
  it("כוללת לפחות 50 רקעים", () => {
    assert.ok(backgroundPresets.length >= 50, `נמצאו ${backgroundPresets.length} בלבד`);
  });

  it("אין מזהים כפולים", () => {
    const ids = backgroundPresets.map((preset) => preset.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("לכל רקע יש שם, קטגוריה, css ומצב טקסט", () => {
    for (const preset of backgroundPresets) {
      assert.ok(preset.name.length > 0, `${preset.id} ללא שם`);
      assert.ok(preset.css.length > 0, `${preset.id} ללא css`);
      assert.ok(["dark", "light"].includes(preset.foreground), `${preset.id} foreground לא תקין`);
      assert.ok(backgroundCategories.some((entry) => entry.id === preset.category), `${preset.id} קטגוריה לא מוכרת`);
    }
  });

  it("כל קטגוריה מכילה רקעים", () => {
    for (const entry of backgroundCategories) {
      assert.ok(countByCategory(entry.id) > 0, `הקטגוריה ${entry.label} ריקה`);
    }
  });

  it("מזהה לא קיים חוזר לברירת המחדל", () => {
    assert.equal(isBackgroundId("no-such-background"), false);
    assert.equal(getBackground("no-such-background").id, "aurora");
  });

  it("חיפוש לפי שם ולפי מילת מפתח", () => {
    assert.ok(searchBackgrounds("יוקרה", "luxury").length > 0);
    assert.ok(searchBackgrounds("כחול").length > 0, "חיפוש 'כחול' לא החזיר תוצאות");
    assert.equal(searchBackgrounds("זזזזזז").length, 0);
  });

  it("סינון לפי קטגוריה מחזיר רק אותה קטגוריה", () => {
    for (const preset of searchBackgrounds("", "dark")) {
      assert.equal(preset.category, "dark");
    }
  });

  it("אין css שמפנה לתמונה חיצונית", () => {
    for (const preset of backgroundPresets) {
      assert.ok(!/url\s*\(/i.test(preset.css), `${preset.id} מכיל url() — הרקעים חייבים להיות CSS טהור`);
    }
  });
});

describe("ניגודיות", () => {
  it("שחור מול לבן הוא 21:1", () => {
    assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.1);
  });

  it("צבעים זהים הם 1:1", () => {
    assert.ok(Math.abs(contrastRatio("#6d4aff", "#6d4aff") - 1) < 0.01);
  });

  it("צבע לא תקין מחזיר 0 ולא קורס", () => {
    assert.equal(contrastRatio("not-a-color", "#ffffff"), 0);
    assert.equal(contrastRatio("#fff", "also-bad"), 0);
  });

  it("תומך בקיצור בן 3 ספרות", () => {
    assert.ok(Math.abs(contrastRatio("#fff", "#000") - 21) < 0.1);
  });

  it("מציע טקסט לבן על רקע כהה וכהה על רקע בהיר", () => {
    assert.equal(readableTextColor("light"), "#ffffff");
    assert.equal(readableTextColor("dark"), "#101223");
    assert.equal(readableTextColor("#0b1020"), "#ffffff");
    assert.equal(readableTextColor("#ffffff"), "#101223");
  });

  it("מזהה ניגודיות נמוכה ומציע חלופה", () => {
    const verdict = checkContrast("#cccccc", "#ffffff");
    assert.equal(verdict.passes, false);
    assert.equal(verdict.suggestion, "#101223");
    assert.match(verdict.message, /נמוכה מדי/);
  });

  it("מאשר ניגודיות תקינה", () => {
    const verdict = checkContrast("#101223", "#ffffff");
    assert.equal(verdict.passes, true);
    assert.equal(verdict.level, "AA");
  });

  it("טקסט גדול נבדק מול דרישה מקלה", () => {
    // #8a8a8a על לבן = 3.45:1 — נכשל בטקסט רגיל (4.5) ועובר בטקסט גדול (3).
    const strict = checkContrast("#8a8a8a", "#ffffff");
    const large = checkContrast("#8a8a8a", "#ffffff", { large: true });
    assert.equal(strict.passes, false);
    assert.equal(large.passes, true);
  });

  it("לכל רקע יש צבע טקסט שעומד בדרישה", () => {
    for (const preset of backgroundPresets) {
      const surface = preset.foreground === "light" ? "#101223" : "#ffffff";
      const suggested = readableTextColor(preset.foreground);
      const verdict = checkContrast(suggested, surface, { large: true });
      assert.ok(verdict.passes, `${preset.id}: הצבע המוצע ${suggested} אינו עובר (${verdict.ratio.toFixed(1)}:1)`);
    }
  });
});
