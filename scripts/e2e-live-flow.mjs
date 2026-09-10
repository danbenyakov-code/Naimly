/**
 * מסע לקוח מלא מול הפרודקשן החי, כמשתמש אמיתי.
 *
 * כל הכתיבות נעשות עם מפתח anon ו-session של המשתמש, ולא עם service-role.
 * זו הנקודה: service-role עוקף RLS ואת אכיפת המסלול, ולכן בדיקה איתו
 * מוכיחה רק שהטבלה קיימת. כאן נבדקות בפועל שלוש השכבות.
 *
 * שימוש:
 *   node scripts/e2e-live-flow.mjs <email> <password> [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const email = process.argv[2];
const password = process.argv[3];
const base = (process.argv[4] || "https://naimly-mu.vercel.app").replace(/\/$/, "");

if (!email || !password) {
  console.error("\nשימוש: node scripts/e2e-live-flow.mjs <email> <password> [baseUrl]\n");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let passed = 0;
let failed = 0;
const fail = (name, detail) => { failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); };
const pass = (name, detail) => { passed++; console.log(`  ✓ ${name}${detail ? `  — ${detail}` : ""}`); };
const check = (name, condition, detail) => (condition ? pass(name, detail) : fail(name, detail));

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const user = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ── 1. התחברות ───────────────────────────────────────────────────────────────
console.log("\n== 1. התחברות ==");
const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error(`  ✗ ההתחברות נכשלה: ${signInError.message}\n`);
  process.exit(1);
}
const userId = session.user.id;
pass("התחברות עם אימייל וסיסמה", userId);

// ── 2. שער ההצטרפות ─────────────────────────────────────────────────────────
console.log("\n== 2. שער ההצטרפות ==");
/*
 * איפוס לפני הבדיקה. בלי זה ריצה שנייה נכשלת על מצב שהריצה הראשונה
 * יצרה, וזה נראה כמו באג במוצר במקום באג בבדיקה.
 */
if (!process.argv.includes("--keep")) {
  await admin.from("cards").delete().eq("user_id", userId);
  await admin.from("subscriptions").update({
    plan_selected_at: null,
    trial_pending: true,
    trial_started_at: null,
    trial_ends_at: null,
    current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    plan_id: "trial",
    status: "trialing",
  }).eq("user_id", userId);
  console.log("  ↺ המצב אופס למשתמש שטרם בחר מסלול");
}

const readSub = async () =>
  (await admin.from("subscriptions").select("plan_id,status,plan_selected_at,trial_ends_at,trial_pending").eq("user_id", userId).single()).data;

let sub = await readSub();
const startedGated = !sub.plan_selected_at;
check("טרם נבחר מסלול", startedGated, startedGated ? "plan_selected_at ריק" : `כבר נבחר ב-${sub.plan_selected_at}`);

const { data: planBefore } = await admin.rpc("effective_plan", { target_user: userId });
check("effective_plan מחזיר none לפני בחירה", !startedGated || planBefore === "none", `בפועל: ${planBefore}`);

// עריכה לפני בחירה חייבת להיחסם על ידי הטריגר במסד.
if (startedGated) {
  const { error: blocked } = await user.from("cards").insert({
    user_id: userId, slug: `gate-probe-${Date.now()}`, business_name: "בדיקה", owner_name: "בדיקה",
  });
  check("יצירת כרטיס חסומה לפני בחירת מסלול", Boolean(blocked), blocked?.message?.slice(0, 90) || "לא נחסם!");
}

// ── 3. בחירת התנסות ─────────────────────────────────────────────────────────
console.log("\n== 3. בחירת ההתנסות ==");
const { data: endsAt, error: selectError } = await user.rpc("select_trial_plan");
check("select_trial_plan רצה בהצלחה", !selectError, selectError?.message);

sub = await readSub();
check("plan_selected_at נקבע", Boolean(sub.plan_selected_at));
check("trial_ends_at נקבע", Boolean(sub.trial_ends_at));
check("trial_pending כבוי", sub.trial_pending === false);

const daysLeft = sub.trial_ends_at ? (new Date(sub.trial_ends_at) - Date.now()) / 86400000 : 0;
check("הספירה היא 14 יום", daysLeft > 13.9 && daysLeft <= 14, `${daysLeft.toFixed(2)} ימים`);

// בחירה חוזרת אסור שתאריך את ההתנסות.
const { data: secondCall } = await user.rpc("select_trial_plan");
check("בחירה חוזרת אינה מאפסת את הספירה", new Date(secondCall).getTime() === new Date(endsAt).getTime());

const { data: planAfter } = await admin.rpc("effective_plan", { target_user: userId });
check("effective_plan הפך ל-trial", planAfter === "trial", planAfter);

// ── 4. בניית כרטיס מלא ──────────────────────────────────────────────────────
console.log("\n== 4. בניית הכרטיס ==");
const slug = `naimly-demo-${String(Date.now()).slice(-6)}`;

const card = {
  user_id: userId,
  slug,
  business_name: "מאפיית לחם הארץ",
  owner_name: "דן בן יעקב",
  role_title: "בעלים ואופה ראשי",
  slogan: "לחם מחמצת אמיתי, נאפה כל בוקר מחדש",
  bio: "מאפייה שכונתית בתל אביב. אנחנו אופים לחמי מחמצת, מאפים מלוחים ועוגות בהזמנה, מקמח מקומי וללא משפרי אפייה. אפשר להזמין מראש ולאסוף, או לקבל משלוח באזור.",
  cta_label: "להזמנת מאפים",
  phone: "03-5551234",
  whatsapp: "972552951664",
  email: "info.naimly@gmail.com",
  website: "https://naimly-mu.vercel.app",
  primary_color: "#6d4aff",
  accent_color: "#0a9b81",
  button_color: "#6d4aff",
  template: "spotlight",
  background_preset: "aurora",
  gallery_style: "grid",
  allow_indexing: true,
  seo_title: "מאפיית לחם הארץ — מחמצת טרייה בתל אביב",
  seo_description: "מאפייה שכונתית בתל אביב: לחמי מחמצת, מאפים מלוחים ועוגות בהזמנה. הזמנה מראש ואיסוף עצמי או משלוח.",
  area_served: "תל אביב והמרכז",
  card_address: {
    street: "אלנבי", houseNumber: "42", city: "תל אביב-יפו", postalCode: "6522004",
    country: "ישראל", lat: 32.0668, lng: 34.7699,
  },
  business_hours: [
    { day: "ראשון–רביעי", hours: "07:00–19:00" },
    { day: "חמישי", hours: "07:00–20:00" },
    { day: "שישי", hours: "06:30–14:00" },
    { day: "שבת", hours: "סגור" },
  ],
  quick_actions: [
    { id: "qa-1", type: "phone", label: "חיוג", icon: "phone", value: "03-5551234", enabled: true },
    { id: "qa-2", type: "whatsapp", label: "וואטסאפ", icon: "message-circle", value: "972552951664", enabled: true },
    { id: "qa-3", type: "waze", label: "ניווט", icon: "map", value: "", enabled: true },
    { id: "qa-4", type: "email", label: "אימייל", icon: "mail", value: "info.naimly@gmail.com", enabled: true },
    { id: "qa-5", type: "website", label: "התפריט", icon: "utensils", value: "https://naimly-mu.vercel.app/pricing", enabled: true },
    { id: "qa-6", type: "save_contact", label: "שמירת איש קשר", icon: "user-plus", value: "", enabled: true },
  ],
  quick_actions_limit: 9,
  services: [
    { id: "s1", title: "לחמי מחמצת", description: "כפרי, שיפון מלא וזיתים. נאפה כל בוקר.", price: "18–32 ₪" },
    { id: "s2", title: "מאפים מלוחים", description: "בורקס גבינות, קרואסון חמאה וכיסוני תרד.", price: "12–19 ₪" },
    { id: "s3", title: "עוגות בהזמנה", description: "לאירועים, בהתאמה אישית. הזמנה 48 שעות מראש.", price: "מ‑140 ₪" },
  ],
  testimonials: [
    { id: "t1", name: "מיכל אברהמי", text: "הלחם הכי טוב בשכונה. באמת אופים כל בוקר, וזה מורגש.", rating: 5 },
    { id: "t2", name: "יואב שגיא", text: "אנחנו מזמינים מהם כבר שנתיים. אמינות מוחלטת בשעות ובאיכות.", rating: 5 },
  ],
  social_links: [
    { id: "sl1", platform: "instagram", label: "אינסטגרם", url: "https://instagram.com/naimly", enabled: true },
  ],
  widgets: [
    { id: "w1", type: "services", title: "מה אנחנו אופים", enabled: true },
    { id: "w2", type: "testimonials", title: "מה אומרים עלינו", enabled: true },
    { id: "w3", type: "hours", title: "שעות פתיחה", enabled: true },
    { id: "w4", type: "contact_form", title: "נשמח לשמוע ממך", enabled: true },
  ],
  contact_form_title: "נשמח לשמוע ממך",
  contact_form_success_message: "קיבלנו את הפנייה. נחזור אליך היום, בדרך כלל תוך שעתיים.",
  vcard: { firstName: "דן", lastName: "בן יעקב", organization: "מאפיית לחם הארץ", title: "בעלים ואופה ראשי" },
};

const { data: created, error: createError } = await user.from("cards").insert(card).select("id,slug").single();
if (createError) {
  fail("יצירת הכרטיס", createError.message);
  console.log(`\n============================================================\nעברו: ${passed} | נכשלו: ${failed}\n`);
  process.exit(1);
}
pass("יצירת כרטיס עם 5 פעולות, 3 שירותים, 2 המלצות ושעות פעילות", created.slug);

// אכיפת המסלול: מכסה מעל המותר חייבת להיחסם גם בהתנסות.
const { error: overQuota } = await user
  .from("cards")
  .update({ gallery: Array.from({ length: 150 }, (_, i) => `https://example.com/${i}.jpg`) })
  .eq("id", created.id);
check("מכסת גלריה מעל 100 נחסמת גם בהתנסות", Boolean(overQuota), overQuota?.message?.slice(0, 80) || "לא נחסם!");

// ── 5. פרסום ────────────────────────────────────────────────────────────────
console.log("\n== 5. פרסום ==");
const { error: publishError } = await user.from("cards").update({ is_published: true }).eq("id", created.id);
check("פרסום הכרטיס", !publishError, publishError?.message);

const subAfterPublish = await readSub();
const daysAfter = (new Date(subAfterPublish.trial_ends_at) - Date.now()) / 86400000;
check("הפרסום לא האריך את ההתנסות", Math.abs(daysAfter - daysLeft) < 0.01, `${daysAfter.toFixed(2)} ימים`);

// ── 6. הכרטיס הציבורי ───────────────────────────────────────────────────────
console.log("\n== 6. הכרטיס הציבורי ==");
const { data: publicRow } = await anon.from("cards").select("slug,business_name").eq("id", created.id);
check("מבקר אנונימי קורא את הכרטיס דרך RLS", publicRow?.length === 1);

const page = await fetch(`${base}/${slug}`, { headers: { "user-agent": "naimly-e2e" } });
const html = await page.text();
check("העמוד הציבורי נטען", page.status === 200, `HTTP ${page.status}`);

const mustContain = [
  ["שם העסק", "מאפיית לחם הארץ"],
  ["הסלוגן", "לחם מחמצת אמיתי"],
  ["שירות", "לחמי מחמצת"],
  ["המלצה", "מיכל אברהמי"],
  ["שעות פעילות", "06:30–14:00"],
  ["כתובת", "אלנבי"],
  ["פעולה מהירה", "וואטסאפ"],
  ["כותרת טופס", "נשמח לשמוע ממך"],
  ["פעולה עם סוג לא סטנדרטי", "שמירת איש קשר"],
];
for (const [label, needle] of mustContain) {
  check(`${label} מופיע בעמוד`, html.includes(needle), needle);
}
check("תגית RTL", /dir="rtl"/.test(html));
check("viewport למובייל", /name="viewport"/.test(html));
check("כותרת SEO", html.includes("מאפיית לחם הארץ — מחמצת טרייה"));

// ── 7. vCard ────────────────────────────────────────────────────────────────
console.log("\n== 7. vCard ==");
const vcard = await fetch(`${base}/api/vcard/${slug}`);
const vtext = await vcard.text();
check("vCard נטען", vcard.status === 200, `HTTP ${vcard.status}`);
check("מבנה vCard תקין", vtext.startsWith("BEGIN:VCARD") && vtext.trimEnd().endsWith("END:VCARD"));
check("שורות מופרדות ב-CRLF", vtext.includes("\r\n"));
check("שם העסק ב-ORG", /ORG:.*לחם הארץ/.test(vtext));
check("טלפון", /TEL/.test(vtext));
check("כתובת מובנית ב-ADR", /ADR/.test(vtext) && vtext.includes("אלנבי"));

// ── 8. ליד מהכרטיס הציבורי ──────────────────────────────────────────────────
console.log("\n== 8. ליד מהעמוד הציבורי ==");
const leadRes = await fetch(`${base}/api/leads`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ slug, name: "לקוח בדיקה", phone: "0501234567", email: "", message: "אשמח להזמין עוגה ליום שישי, אפשר?" }),
});
check("שליחת ליד מתקבלת", leadRes.ok, `HTTP ${leadRes.status}`);

const { data: leads } = await user.from("leads").select("id,name,message").eq("card_id", created.id);
check("בעל הכרטיס רואה את הליד", (leads?.length ?? 0) >= 1, `${leads?.length ?? 0} לידים`);

const { data: leakedLeads } = await anon.from("leads").select("id").eq("card_id", created.id);
check("הליד אינו נחשף לאנונימי", (leakedLeads?.length ?? 0) === 0);

// ── סיכום ───────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`עברו: ${passed} | נכשלו: ${failed}`);
console.log(`\nהכרטיס החי:  ${base}/${slug}`);
console.log(`vCard:       ${base}/api/vcard/${slug}\n`);
process.exit(failed ? 1 : 0);
