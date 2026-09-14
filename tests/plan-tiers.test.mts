import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { plans } from "../src/lib/config.ts";
import { planFeatures, planLimits, paidPlanOrder, requiredPlanForLimit } from "../src/lib/plan-access.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

/**
 * קריאת המכסות מתוך המיגרציה.
 *
 * זו הבדיקה שמונעת את הפער המסוכן ביותר במוצר הזה: המחירון מבטיח מכסה
 * אחת, המסד אוכף אחרת, והלקוח מגלה את ההפרש רק כשהשמירה נדחית.
 */
function limitsFromMigration() {
  const sql = read("supabase/migrations/019_plan_tiers_and_videos.sql");
  const rows: Record<string, number[]> = {};

  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("('")) continue;
    const planId = trimmed.slice(2, trimmed.indexOf("'", 2));
    const inside = trimmed.slice(trimmed.indexOf(",") + 1, trimmed.lastIndexOf(")"));
    const numbers = inside
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && part[0] >= "0" && part[0] <= "9")
      .map(Number);
    if (numbers.length >= 6) rows[planId] = numbers;
  }
  return rows;
}

describe("המכסות זהות באפליקציה ובמסד", () => {
  const migration = limitsFromMigration();

  it("המיגרציה מגדירה את כל ארבעת המסלולים", () => {
    assert.deepEqual(Object.keys(migration).sort(), ["basic", "premium", "pro", "trial"]);
  });

  for (const plan of plans) {
    it(`מסלול ${plan.id} — cards, gallery, actions, files, videos, analytics`, () => {
      // הסדר בשורת ה-SQL: cards, gallery, actions, files, videos, analytics_days.
      const [cards, gallery, actions, files, videos, analyticsDays] = migration[plan.id];
      const limits = planLimits(plan.id);

      assert.equal(limits.cards, cards, "cards");
      assert.equal(limits.galleryItems, gallery, "galleryItems");
      assert.equal(limits.quickActions, actions, "quickActions");
      assert.equal(limits.files, files, "files");
      assert.equal(limits.videos, videos, "videos");
      assert.equal(limits.analyticsDays, analyticsDays, "analyticsDays");
    });
  }
});

describe("ההבדל בין המסלולים ברור וגדל", () => {
  it("כל מכסה עולה או נשארת לאורך הסולם", () => {
    /*
     * מסלול יקר יותר שמעניק פחות הוא תמחור שבור. הבדיקה תופסת שינוי
     * ידני שהופך את הסולם בלי לשים לב.
     */
    for (const key of ["galleryItems", "quickActions", "files", "videos", "analyticsDays", "cards"] as const) {
      let previous = 0;
      for (const planId of paidPlanOrder) {
        const value = planLimits(planId)[key] as number;
        assert.ok(value >= previous, `${key} יורד ב-${planId}: ${value} < ${previous}`);
        previous = value;
      }
    }
  });

  it("לכל מסלול בתשלום יש לפחות יכולת אחת שאין בזול ממנו", () => {
    const keys = ["tracking", "leadExport", "carousel", "video", "files", "seo"] as const;
    for (let index = 1; index < paidPlanOrder.length; index += 1) {
      const previous = planFeatures(paidPlanOrder[index - 1]);
      const current = planFeatures(paidPlanOrder[index]);
      const gainedFeature = keys.some((key) => current[key] && !previous[key]);
      const gainedQuota = (["galleryItems", "quickActions", "files", "videos", "cards"] as const).some(
        (key) => (planLimits(paidPlanOrder[index])[key] as number) > (planLimits(paidPlanOrder[index - 1])[key] as number),
      );
      assert.ok(gainedFeature || gainedQuota, `${paidPlanOrder[index]} אינו מוסיף דבר`);
    }
  });

  it("ההתנסות זהה לפרימיום ביכולות", () => {
    // "התנסות כמו פרימיום" — אם זה לא נכון, המחירון משקר.
    const trial = planFeatures("trial");
    const premium = planFeatures("premium");
    assert.deepEqual(trial, premium);
  });

  it("ההתנסות אינה מעניקה כרטיס שני", () => {
    // כרטיס שנפתח בהתנסות ונסגר בסיומה הוא הבטחה שנשברת.
    assert.equal(planLimits("trial").cards, 1);
    assert.equal(planLimits("premium").cards, 2);
  });

  it("בסיסי אינו כולל וידאו, מקצועי כולל אחד ופרימיום שניים", () => {
    assert.equal(planLimits("basic").videos, 0);
    assert.equal(planFeatures("basic").video, false);
    assert.equal(planLimits("pro").videos, 1);
    assert.equal(planLimits("premium").videos, 2);
  });

  it("requiredPlanForLimit מפנה למסלול הזול שמספיק", () => {
    assert.equal(requiredPlanForLimit("videos", 1), "pro");
    assert.equal(requiredPlanForLimit("videos", 2), "premium");
    assert.equal(requiredPlanForLimit("cards", 2), "premium");
  });
});

describe("המחירון אינו מבטיח מה שאינו נאכף", () => {
  const pricing = read("src/app/pricing/page.tsx");

  it("הטבלה נגזרת מהמכסות ולא מוקלדת", () => {
    assert.ok(pricing.includes("planLimits(plan.id).galleryItems"));
    assert.ok(pricing.includes("planLimits(plan.id).videos"));
    assert.ok(pricing.includes("planLimits(plan.id).cards"));
  });

  it("אין יותר אזכור לתמיכה מועדפת", () => {
    for (const path of [
      "src/app/pricing/page.tsx",
      "src/lib/config.ts",
      "src/lib/plan-access.ts",
      "src/components/dashboard/plan-summary-card.tsx",
    ]) {
      assert.ok(!read(path).includes("תמיכה מועדפת"), `${path} עדיין מזכיר תמיכה מועדפת`);
      assert.ok(!read(path).includes("prioritySupport"), `${path} עדיין מזכיר prioritySupport`);
    }
  });

  it("אין יותר מכסה של 100 תמונות", () => {
    // "100 תמונות" אינה מכסה אלא הצהרה שמטשטשת את ההבדל בין המסלולים.
    for (const plan of plans) {
      assert.ok(planLimits(plan.id).galleryItems <= 24, `${plan.id}: ${planLimits(plan.id).galleryItems}`);
    }
  });

  it("מכסה אפס מוצגת כ'לא כלול' ולא כספרה", () => {
    assert.ok(pricing.includes("if (value === 0) return false"));
  });
});

describe("אכיפת הסרטונים בשלוש השכבות", () => {
  it("הממשק מגביל הוספה", () => {
    const builder = read("src/components/dashboard/card-builder-v2.tsx");
    assert.ok(builder.includes("if (videoList.length >= limits.videos) return"));
  });

  it("השרת דוחה חריגה", () => {
    const route = read("src/app/api/cards/route.ts");
    assert.ok(route.includes("requestedVideos.length > limits.videos"));
    assert.ok(route.includes('requiredPlanForFeature("video")'));
  });

  it("המסד אוכף בטריגר", () => {
    const sql = read("supabase/migrations/019_plan_tiers_and_videos.sql");
    assert.ok(sql.includes("enforce_video_limit"));
    assert.ok(sql.includes("cards_enforce_video_limit"));
    assert.ok(sql.includes("PLAN_LIMIT:video"));
  });

  it("גיזום למסלול מוריד סרטונים עודפים", () => {
    const access = read("src/lib/plan-access.ts");
    assert.ok(access.includes("videos: features.video ? card.videos.slice(0, limits.videos) : []"));
  });
});
