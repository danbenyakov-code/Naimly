import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * בדיקות RLS מול פרויקט Supabase אמיתי.
 *
 * ללא משתני סביבה כל הבדיקות מדולגות — כך שהחליפה נשארת ירוקה בפיתוח
 * מקומי, ומאמתת בפועל ברגע שהחיבור קיים. אין כאן העמדת פנים שהבדיקה רצה.
 */

for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const skipReason = configured ? undefined : "אין חיבור Supabase — יש להגדיר .env.local";

/** שני משתמשי בדיקה שנוצרים ונמחקים בתוך החליפה. */
type TestUser = { id: string; email: string; client: SupabaseClient };

let admin: SupabaseClient;
let anon: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let cardA: string;

const password = "RlsTest!2026Xk";
const stamp = Date.now();

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${stamp}@naimly.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `בדיקת RLS ${label}` },
  });
  if (error || !data.user) throw new Error(`יצירת משתמש ${label} נכשלה: ${error?.message}`);

  const client = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`התחברות ${label} נכשלה: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

describe("RLS — בידוד נתונים בין משתמשים", { skip: skipReason }, () => {
  before(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    anon = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });

    userA = await createUser("a");
    userB = await createUser("b");

    // כרטיס של משתמש א׳, נוצר עם service-role כדי לעקוף את אכיפת המסלול.
    const { data, error } = await admin
      .from("cards")
      .insert({
        user_id: userA.id,
        slug: `rls-test-${stamp}`,
        business_name: "עסק בדיקה",
        owner_name: "בודק א",
        is_published: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`יצירת כרטיס נכשלה: ${error.message}`);
    cardA = data.id;

    // ליד ששייך לכרטיס של א׳.
    await admin.from("leads").insert({
      card_id: cardA,
      name: "ליד בדיקה",
      phone: "0500000000",
      message: "בדיקת RLS",
    });
  });

  after(async () => {
    if (!admin) return;
    await admin.from("cards").delete().eq("id", cardA);
    for (const user of [userA, userB]) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id).catch(() => null);
    }
  });

  // ── פרופילים ──────────────────────────────────────────────────────────────
  it("משתמש קורא רק את הפרופיל שלו", async () => {
    const { data } = await userA.client.from("profiles").select("id");
    assert.ok(data, "לא הוחזרו נתונים");
    assert.equal(data.length, 1);
    assert.equal(data[0].id, userA.id);
  });

  it("משתמש אינו יכול לשנות את התפקיד שלו", async () => {
    const { error } = await userA.client.from("profiles").update({ role: "admin" }).eq("id", userA.id);
    assert.ok(error, "עדכון role עבר — הרשאת העמדה אינה נאכפת!");
  });

  it("משתמש אינו יכול לשנות את המסלול שלו", async () => {
    const { error } = await userA.client.from("profiles").update({ plan_id: "premium" }).eq("id", userA.id);
    assert.ok(error, "עדכון plan_id עבר — אפשר להעלות מסלול ללא תשלום!");
  });

  it("משתמש אינו קורא את הפרופיל של אחר", async () => {
    const { data } = await userB.client.from("profiles").select("id").eq("id", userA.id);
    assert.equal(data?.length ?? 0, 0);
  });

  // ── כרטיסים ───────────────────────────────────────────────────────────────
  it("משתמש אינו יכול לערוך כרטיס של אחר", async () => {
    const { data } = await userB.client.from("cards").update({ business_name: "נחטף" }).eq("id", cardA).select("id");
    assert.equal(data?.length ?? 0, 0, "עדכון כרטיס של משתמש אחר הצליח!");
  });

  it("משתמש אינו יכול למחוק כרטיס של אחר", async () => {
    await userB.client.from("cards").delete().eq("id", cardA);
    const { data } = await admin.from("cards").select("id").eq("id", cardA);
    assert.equal(data?.length, 1, "הכרטיס נמחק על ידי משתמש אחר!");
  });

  it("מבקר אנונימי קורא כרטיס מפורסם עם מנוי בתוקף", async () => {
    const { data } = await anon.from("cards").select("slug").eq("id", cardA);
    assert.equal(data?.length, 1, "כרטיס מפורסם אינו נקרא לציבור");
  });

  it("מבקר אנונימי אינו קורא כרטיס שאינו מפורסם", async () => {
    await admin.from("cards").update({ is_published: false }).eq("id", cardA);
    const { data } = await anon.from("cards").select("slug").eq("id", cardA);
    assert.equal(data?.length ?? 0, 0, "כרטיס לא מפורסם נחשף לציבור!");
    await admin.from("cards").update({ is_published: true }).eq("id", cardA);
  });

  // ── לידים ─────────────────────────────────────────────────────────────────
  it("בעל הכרטיס רואה את הלידים שלו", async () => {
    const { data } = await userA.client.from("leads").select("id").eq("card_id", cardA);
    assert.ok((data?.length ?? 0) >= 1, "בעל הכרטיס אינו רואה את הלידים שלו");
  });

  it("משתמש אחר אינו רואה את הלידים", async () => {
    const { data } = await userB.client.from("leads").select("id").eq("card_id", cardA);
    assert.equal(data?.length ?? 0, 0, "לידים של משתמש אחד נחשפו לאחר!");
  });

  it("מבקר אנונימי אינו קורא לידים", async () => {
    const { data, error } = await anon.from("leads").select("id");
    assert.ok(error || (data?.length ?? 0) === 0, "לידים נחשפו לאנונימי!");
  });

  // ── מנויים ובקשות תשלום ───────────────────────────────────────────────────
  it("משתמש אינו יכול להפעיל מנוי בעצמו", async () => {
    const { error } = await userA.client
      .from("subscriptions")
      .update({ status: "active", plan_id: "premium" })
      .eq("user_id", userA.id);
    assert.ok(error, "משתמש הפעיל מנוי בעצמו — עקיפת תשלום!");
  });

  it("משתמש אינו יכול לאשר בקשת תשלום", async () => {
    const { data: request } = await admin
      .from("payment_requests")
      .insert({ user_id: userA.id, reference: `RLS-${stamp}`, plan_id: "pro", amount: 49 })
      .select("id")
      .single();

    const { data } = await userA.client
      .from("payment_requests")
      .update({ status: "approved" })
      .eq("id", request!.id)
      .select("id");
    assert.equal(data?.length ?? 0, 0, "משתמש אישר את בקשת התשלום של עצמו!");

    await admin.from("payment_requests").delete().eq("id", request!.id);
  });

  it("משתמש אינו יכול לקרוא את פונקציית ההפעלה", async () => {
    const { error } = await userA.client.rpc("activate_subscription", {
      target_user: userA.id,
      target_plan: "premium",
      months: 12,
      actor: null,
    });
    assert.ok(error, "משתמש הריץ activate_subscription — עקיפת תשלום!");
  });

  // ── יומן ביקורת ───────────────────────────────────────────────────────────
  it("משתמש רגיל אינו קורא את יומן הביקורת", async () => {
    const { data } = await userA.client.from("admin_audit_log").select("id");
    assert.equal(data?.length ?? 0, 0, "יומן הביקורת נחשף למשתמש רגיל!");
  });

  // ── אכיפת מסלול ב-DB ──────────────────────────────────────────────────────
  it("הטריגר חוסם מכסת גלריה מעל המסלול", async () => {
    const tooMany = Array.from({ length: 200 }, (_, index) => `https://example.com/img-${index}.jpg`);
    const { error } = await userA.client.from("cards").update({ gallery: tooMany }).eq("id", cardA);
    assert.ok(error, "אפשר היה לשמור יותר תמונות מהמכסה!");
    assert.match(error.message, /PLAN_LIMIT|check_violation|תמונות/i);
  });
});
