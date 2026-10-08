import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attributionFromParams, badgeHref, parseAttributionCookie } from "../src/lib/attribution.ts";
import { canHideBranding, clampCardToPlan } from "../src/lib/plan-access.ts";
import { signupSourceLabel } from "../src/lib/user-control.ts";
import { demoCard } from "../src/lib/demo-data.ts";

describe("קישור התג", () => {
  it("נושא את פרמטרי ה-utm ואת כתובת הכרטיס", () =>
    assert.equal(badgeHref("noa-design"), "/?utm_source=card_badge&utm_medium=referral&utm_campaign=noa-design"));
});

describe("מקור ההרשמה", () => {
  it("נקלט מה-URL", () => {
    const attribution = attributionFromParams(new URLSearchParams(badgeHref("noa-design").slice(2)), new Date("2026-10-08T06:00:00Z"));
    assert.deepEqual(attribution, { source: "card_badge", medium: "referral", campaign: "noa-design", landedAt: "2026-10-08T06:00:00.000Z" });
  });
  it("בלי utm_source אין מקור", () => assert.equal(attributionFromParams(new URLSearchParams("utm_campaign=x")), null));
  it("ערכים מנוקים: בלי HTML ובלי אורך חריג", () => {
    const attribution = attributionFromParams(new URLSearchParams(`utm_source=<script>&utm_campaign=${"a".repeat(200)}`));
    assert.equal(attribution?.source, "script");
    assert.equal(attribution?.campaign.length, 60);
  });
  it("עוגייה פגומה לא מפילה את ההרשמה", () => {
    assert.equal(parseAttributionCookie("not json"), null);
    assert.equal(parseAttributionCookie(undefined), null);
    assert.equal(parseAttributionCookie(JSON.stringify({ source: "card_badge", campaign: "dana" }))?.campaign, "dana");
  });
  it("תיאור קריא", () => {
    assert.equal(signupSourceLabel("card_badge", "dana"), "תג בכרטיס /dana");
    assert.equal(signupSourceLabel(null), "");
  });
});

describe("הסתרת התג", () => {
  it("פרימיום בלבד, לא בניסיון", () => {
    assert.equal(canHideBranding("premium"), true);
    assert.equal(canHideBranding("trial"), false);
    assert.equal(canHideBranding("pro"), false);
    assert.equal(canHideBranding("basic"), false);
  });
  it("שנמוך מפרימיום מחזיר את התג", () => {
    const card = { ...demoCard, hideBranding: true };
    assert.equal(clampCardToPlan(card, "pro").hideBranding, false);
    assert.equal(clampCardToPlan(card, "premium").hideBranding, true);
  });
});
