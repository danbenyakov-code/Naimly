import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("מיגרציה 030 — נעילה ידנית ותפוגה בפועל", () => {
  const migration = read("supabase/migrations/030_subscription_lock_and_expiry.sql");

  it("effective_plan חוסמת נעילה ידנית לפני כל בדיקה אחרת", () => {
    assert.ok(migration.includes("when s.admin_locked then 'none'"));
  });

  it("effective_plan אוכפת תוקף בפועל על מנוי active, לא רק על trialing", () => {
    // זו התקלה שהתגלתה: מנוי 'active' זיכה גישה לצמיתות בלי בדיקת תאריך.
    assert.ok(migration.includes("when s.status = 'active' and coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then s.plan_id"));
  });

  it("subscription_live עוברת את אותה בדיקה בדיוק", () => {
    const bodies = migration.split("create or replace function public.subscription_live");
    assert.ok(bodies[1]?.includes("when s.admin_locked then false"));
    assert.ok(bodies[1]?.includes("coalesce(s.current_period_end, 'infinity'::timestamptz) > now() then true"));
  });

  it("נעילה ידנית מתועדת ב-audit log", () => {
    assert.ok(migration.includes("admin_set_subscription_lock"));
    assert.ok(migration.includes("'subscription.lock'"));
    assert.ok(migration.includes("'subscription.unlock'"));
    assert.ok(migration.includes("admin_audit_log"));
  });

  it("הפונקציה נשללת מ-authenticated — רק service role יכול לנעול", () => {
    assert.ok(migration.includes("revoke execute on function public.admin_set_subscription_lock(uuid, uuid, boolean, text) from public, anon, authenticated"));
  });
});

describe("נתיב נעילה — /api/admin/customers/[id]/lock", () => {
  const route = read("src/app/api/admin/customers/[id]/lock/route.ts");

  it("דורש requireAdmin ולא בודק role בלקוח", () => {
    assert.ok(route.includes("requireAdmin()"));
  });

  it("דורש סיבה כשנועלים", () => {
    assert.ok(route.includes("locked && !parsed.data.reason"));
  });

  it("מתעד audit log על כל נעילה/שחרור", () => {
    assert.ok(route.includes("auditLog(context"));
  });
});

describe("קרון תזכורת חידוש — /api/cron/subscription-renewals", () => {
  const route = read("src/app/api/cron/subscription-renewals/route.ts");

  it("חסום לגמרי בלי CRON_SECRET מוגדר", () => {
    assert.ok(route.includes('if (!secret) return NextResponse.json({ error: "CRON_SECRET אינו מוגדר" }, { status: 503 })'));
  });

  it("בודק את כותרת Authorization בדיוק כפי ש-Vercel Cron שולח", () => {
    assert.ok(route.includes("`Bearer ${secret}`"));
  });

  it("מדלג על לקוחות נעולים ידנית", () => {
    assert.ok(route.includes('.eq("admin_locked", false)'));
  });

  it("לא שולח תזכורת כפולה לאותו תאריך תפוגה", () => {
    assert.ok(route.includes("row.renewal_reminder_period_end === row.current_period_end"));
  });

  it("מסמן את התאריך שנשלחה עבורו התזכורת רק אחרי שליחה מוצלחת בפועל", () => {
    const afterCheck = route.split("if (!customerResult.sent)")[1] || "";
    assert.ok(afterCheck.includes("continue;"), "כשל שליחה לא אמור לסמן שהתזכורת נשלחה");
    assert.ok(route.includes('.update({ renewal_reminder_period_end: row.current_period_end })'));
  });
});

describe("vercel.json — תזמון הקרון", () => {
  it("מוגדר לרוץ פעם ביום", () => {
    const config = JSON.parse(read("vercel.json"));
    const cron = config.crons?.find((entry: { path: string }) => entry.path === "/api/cron/subscription-renewals");
    assert.ok(cron, "הקרון חייב להיות רשום ב-vercel.json");
    assert.equal(cron.schedule.split(" ").length, 5, "תבנית cron תקנית");
  });
});
