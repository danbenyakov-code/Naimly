import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHttpUrl, safeHref, safeInternalPath, safeSrc } from "../src/lib/safe-url.ts";
import { emailSchema, otpSchema, phoneSchema } from "../src/lib/auth-schema.ts";

describe("בטיחות כתובות", () => {
  const dangerous = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)  ",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
  ];

  for (const payload of dangerous) {
    it(`חוסם ${JSON.stringify(payload)}`, () => {
      assert.equal(safeHref(payload), "");
      assert.equal(safeSrc(payload), "");
      assert.equal(isHttpUrl(payload), false);
    });
  }

  it("מאשר http ו-https", () => {
    assert.equal(safeSrc("https://example.com/a.png"), "https://example.com/a.png");
    assert.equal(isHttpUrl("http://example.com"), true);
  });

  it("מאשר mailto ו-tel ל-href אך לא ל-src", () => {
    assert.equal(safeHref("mailto:a@b.com"), "mailto:a@b.com");
    assert.equal(safeHref("tel:+972501234567"), "tel:+972501234567");
    assert.equal(safeSrc("mailto:a@b.com"), "");
  });
});

describe("נתיב פנימי בטוח", () => {
  for (const payload of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "\\\\evil.com", ""]) {
    it(`חוסם ${JSON.stringify(payload)}`, () => {
      assert.equal(safeInternalPath(payload), "/dashboard");
    });
  }

  it("מאשר נתיב פנימי עם פרמטרים", () => {
    assert.equal(safeInternalPath("/checkout?plan=pro"), "/checkout?plan=pro");
  });
});

describe("סכמות אימות", () => {
  it("אימייל תקין עובר", () => {
    assert.equal(emailSchema.safeParse("name@example.co.il").success, true);
  });

  for (const bad of ["", "not-an-email", "a@b", "a b@c.com", "@example.com"]) {
    it(`אימייל פסול נדחה: ${JSON.stringify(bad)}`, () => {
      const result = emailSchema.safeParse(bad);
      assert.equal(result.success, false);
      assert.ok(result.error!.issues[0].message.length > 0);
    });
  }

  it("קוד בן 6 ספרות עובר", () => {
    assert.equal(otpSchema.safeParse("123456").success, true);
  });

  it("קוד חלקי נדחה עם הסבר", () => {
    const result = otpSchema.safeParse("123");
    assert.equal(result.success, false);
    assert.match(result.error!.issues[0].message, /6/);
  });

  it("טלפון ישראלי ובינלאומי עוברים, וניקוד מנוקה", () => {
    assert.equal(phoneSchema.safeParse("050-123-4567").success, true);
    assert.equal(phoneSchema.safeParse("+972 50 123 4567").success, true);
    assert.equal(phoneSchema.safeParse("").success, true, "שדה ריק מותר — הטלפון אופציונלי");
  });

  it("טלפון קצר מדי נדחה", () => {
    const result = phoneSchema.safeParse("12345");
    assert.equal(result.success, false);
  });
});

describe("safeSrc — נתיבים מאותו מקור", () => {
  it("מאשר נתיב שורש רגיל", () => {
    assert.equal(safeSrc("/samples/logo-example.jpg"), "/samples/logo-example.jpg");
    assert.equal(safeSrc("/_next/static/media/a-b_c.woff2"), "/_next/static/media/a-b_c.woff2");
  });

  it("חוסם protocol-relative שמצביע החוצה", () => {
    assert.equal(safeSrc("//evil.example.com/x.jpg"), "");
    assert.equal(safeSrc("///evil.example.com/x.jpg"), "");
  });

  it("חוסם לוכסן הפוך שמנוצל כ-protocol-relative", () => {
    const backslash = String.fromCharCode(92);
    const payload = "/" + backslash + "evil.example.com/x.jpg";
    assert.equal(payload.charCodeAt(1), 92, "הבדיקה חייבת להכיל לוכסן הפוך אמיתי");
    assert.equal(safeSrc(payload), "");
  });

  it("חוסם תווי בקרה בנתיב", () => {
    assert.equal(safeSrc("/samples/\u0000logo.jpg"), "");
    assert.equal(safeSrc("/samples/\u001flogo.jpg"), "");
    assert.equal(safeSrc("/samples/\u007flogo.jpg"), "");
  });

  it("מקף ותו רגיל אינם נחשבים תווי בקרה", () => {
    // רגרסיה: ניסוח שגוי של מחלקת התווים פסל כל מחרוזת עם מקף.
    assert.equal(safeSrc("/a-b/c-d.jpg"), "/a-b/c-d.jpg");
    assert.equal(safeSrc("/a b.jpg"), "/a b.jpg");
  });

  it("עדיין חוסם סכימות מסוכנות", () => {
    assert.equal(safeSrc("javascript:alert(1)"), "");
    assert.equal(safeSrc("data:text/html,<script>alert(1)</script>"), "");
    assert.equal(safeSrc("vbscript:msgbox(1)"), "");
  });

  it("נתיב יחסי בלי לוכסן פותח נדחה", () => {
    assert.equal(safeSrc("samples/logo.jpg"), "");
    assert.equal(safeSrc("../../etc/passwd"), "");
  });
});
