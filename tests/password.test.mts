import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PASSWORD_MIN_LENGTH, evaluatePassword, isStrongPassword, passwordRules } from "../src/lib/password.ts";

describe("מדיניות סיסמה", () => {
  it("דוחה סיסמה ריקה עם הודעה ברורה", () => {
    const result = evaluatePassword("");
    assert.equal(result.valid, false);
    assert.equal(result.error, "יש להזין סיסמה");
    assert.equal(result.score, 0);
  });

  it(`דורשת לפחות ${PASSWORD_MIN_LENGTH} תווים`, () => {
    const result = evaluatePassword("Ab1!xyz");
    assert.equal(result.valid, false);
    assert.match(result.error, /תווים/);
  });

  it("דורשת אות גדולה", () => {
    const result = evaluatePassword("abcdef123!x");
    assert.equal(result.valid, false);
    assert.ok(result.failedRules.some((rule) => rule.id === "upper"));
  });

  it("דורשת אות קטנה", () => {
    const result = evaluatePassword("ABCDEF123!X");
    assert.equal(result.valid, false);
    assert.ok(result.failedRules.some((rule) => rule.id === "lower"));
  });

  it("דורשת ספרה", () => {
    const result = evaluatePassword("AbcdefGhi!x");
    assert.equal(result.valid, false);
    assert.ok(result.failedRules.some((rule) => rule.id === "digit"));
  });

  it("דורשת תו מיוחד", () => {
    const result = evaluatePassword("Abcdef123xyz");
    assert.equal(result.valid, false);
    assert.ok(result.failedRules.some((rule) => rule.id === "symbol"));
  });

  it("מאשרת סיסמה שעומדת בכל הכללים", () => {
    const result = evaluatePassword("Naim!ly2026Xk");
    assert.equal(result.valid, true, result.error);
    assert.equal(result.error, "");
    assert.ok(result.score >= 3, `ציון נמוך מהצפוי: ${result.score}`);
  });

  it("חוסמת סיסמאות נפוצות גם כשהן עומדות בכללים הטכניים", () => {
    const result = evaluatePassword("Password123!");
    assert.equal(result.valid, false);
    assert.match(result.error, /נפוצה/);
  });

  it("חוסמת רצף של אותו תו", () => {
    const result = evaluatePassword("Abcd!1aaaa2X");
    assert.equal(result.valid, false);
    assert.match(result.error, /רצף/);
  });

  it("isStrongPassword תואם ל-evaluatePassword", () => {
    for (const candidate of ["", "short", "Naim!ly2026Xk", "Password123!"]) {
      assert.equal(isStrongPassword(candidate), evaluatePassword(candidate).valid, candidate);
    }
  });

  it("כל כלל מחזיר תווית בעברית", () => {
    for (const rule of passwordRules) {
      assert.ok(rule.label.length > 0);
      assert.match(rule.label, /[֐-׿]/, `הכלל ${rule.id} ללא תווית בעברית`);
    }
  });

  it("הציון עולה עם חוזק הסיסמה", () => {
    const weak = evaluatePassword("abcdefghij").score;
    const medium = evaluatePassword("Abcdefghij1").score;
    const strong = evaluatePassword("Naim!ly2026Xk").score;
    assert.ok(weak <= medium, `${weak} <= ${medium}`);
    assert.ok(medium <= strong, `${medium} <= ${strong}`);
  });
});
