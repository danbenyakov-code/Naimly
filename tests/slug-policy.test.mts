import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBlockedTerm, isSlugAllowed, normalizeForPolicy } from "../src/lib/slug-policy.ts";
import { cardSchema } from "../src/lib/validation.ts";
import { demoCard } from "../src/lib/demo-data.ts";

/** REQ-019 — חסימת מילים אסורות ב-Slug, כולל עקיפות. */

describe("REQ-019 — נרמול שמונע עקיפה", () => {
  it("מקפים ורווחים אינם מסתירים מונח", () => {
    assert.equal(normalizeForPolicy("s-e-x"), "sex");
    assert.equal(normalizeForPolicy("p.o.r.n"), "porn");
  });

  it("החלפת אות בספרה דומה נתפסת", () => {
    assert.equal(normalizeForPolicy("s3x"), "sex");
    assert.equal(normalizeForPolicy("p0rn"), "porn");
    assert.equal(normalizeForPolicy("dr4gs"), "drags");
  });

  it("כפילות אותיות מכווצת", () => {
    assert.equal(normalizeForPolicy("sssexxx"), "sex");
  });

  it("תווי Unicode בלתי נראים מוסרים", () => {
    const zeroWidth = String.fromCharCode(0x200b);
    assert.equal(normalizeForPolicy(`se${zeroWidth}x`), "sex");
  });
});

describe("REQ-019 — חסימה בפועל", () => {
  it("מונחים אסורים נחסמים", () => {
    for (const slug of ["sex-shop", "porn-site", "buy-cocaine", "gun-store", "nazi-club", "s-e-x", "p0rn", "sssex"]) {
      assert.equal(isSlugAllowed(slug), false, `${slug} היה אמור להיחסם`);
    }
  });

  it("עברית נחסמת גם היא", () => {
    for (const slug of ["סקס", "פורנו", "סמים", "נשק"]) {
      assert.equal(isSlugAllowed(slug), false, `${slug} היה אמור להיחסם`);
    }
  });

  it("עסקים לגיטימיים אינם נחסמים", () => {
    for (const slug of ["naimly", "dan-bakery", "tel-aviv-clinic", "studio-noa", "essex-law", "sussex-design", "middlesex-vet"]) {
      assert.equal(isSlugAllowed(slug), true, `${slug} נחסם בטעות`);
    }
  });

  it("המונח שנתפס אינו מוחזר למשתמש", () => {
    const result = cardSchema.safeParse({ ...demoCard, id: "", userId: "u", slug: "sex-shop" });
    assert.equal(result.success, false);
    if (result.success) return;
    const message = result.error.issues.find((i) => i.path[0] === "slug")?.message || "";
    assert.doesNotMatch(message, /sex|porn/i, "אסור להחזיר את המונח הפוגעני בהודעה");
    assert.match(message, /אינה זמינה/);
  });

  it("הבדיקה נאכפת בסכמת השרת ולא רק בממשק", () => {
    assert.equal(cardSchema.safeParse({ ...demoCard, id: "", userId: "u", slug: "porn-hub" }).success, false);
    assert.ok(findBlockedTerm("porn-hub"));
  });
});

describe("REQ-019 — רגרסיה על הפיצול למילים", () => {
  it("מקטע שלם נחסם גם כשהמונח קצר", () => {
    // רגרסיה: פיצול שגוי על האות s גרם לכך שרמת המקטעים לא עבדה כלל.
    assert.equal(isSlugAllowed("my-sex-studio"), false);
    assert.equal(isSlugAllowed("shop-porn-il"), false);
  });

  it("מילים שמתחילות ב-s אינן מפוצלות בטעות", () => {
    assert.equal(isSlugAllowed("studio-sasson"), true);
    assert.equal(isSlugAllowed("sushi-station"), true);
    assert.equal(isSlugAllowed("shalom-services"), true);
  });

  it("הפרדה בקו תחתון ובנקודה מזוהה גם היא", () => {
    assert.equal(isSlugAllowed("my_sex_shop"), false);
    assert.equal(isSlugAllowed("my.porn.site"), false);
  });
});
