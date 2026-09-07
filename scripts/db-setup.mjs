/**
 * הכנת מסד הנתונים: בדיקת חיבור, הרצת מיגרציות ואימות שהאובייקטים נוצרו.
 *
 * הסודות נקראים מ-.env.local (מסונן מ-Git) ולעולם לא נכתבים לקוד או ללוג.
 *
 * שימוש:
 *   node scripts/db-setup.mjs check     # בדיקת חיבור והרשאות בלבד
 *   node scripts/db-setup.mjs verify    # מה קיים במסד ומה חסר
 *   node scripts/db-setup.mjs migrate   # הוראות הרצה + בדיקה אחרי
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── טעינת סביבה ─────────────────────────────────────────────────────────────
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
const command = process.argv[2] || "check";

/** מסתיר סוד בלוג — מציג רק אורך וקידומת. */
const mask = (value) => (value ? `${value.slice(0, 6)}…(${value.length} תווים)` : "(חסר)");

function missingEnv() {
  console.log("\n❌ חסרים משתני סביבה.\n");
  console.log("  NEXT_PUBLIC_SUPABASE_URL      ", url ? "✓" : "✗ חסר");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY ", anonKey ? "✓" : "✗ חסר");
  console.log("  SUPABASE_SERVICE_ROLE_KEY     ", serviceKey ? "✓" : "✗ חסר");
  console.log("\nאיפה למצוא: Supabase Dashboard → הפרויקט → Settings → API");
  console.log("\nיוצרים קובץ .env.local בשורש הפרויקט (מסונן מ-Git):\n");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...\n");
  process.exit(1);
}

if (!url || !anonKey || !serviceKey) missingEnv();

console.log("\n=== חיבור ===");
console.log("  URL:     ", url);
console.log("  anon:    ", mask(anonKey));
console.log("  service: ", mask(serviceKey));

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ── מה אמור להתקיים אחרי כל המיגרציות ───────────────────────────────────────
const expectedTables = [
  "profiles", "cards", "card_events", "leads", "subscriptions",
  "admin_audit_log", "payment_events", "plan_limits", "payment_requests", "contact_messages",
];

const expectedFunctions = ["is_admin", "effective_plan", "subscription_live", "activate_subscription", "enforce_plan_limits"];

/** קודי השגיאה שמעידים על טבלה שאינה קיימת. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST106"]);

async function tableExists(name) {
  const { error } = await admin.from(name).select("id").limit(1);
  if (!error) return true;
  if (MISSING_TABLE_CODES.has(error.code)) return false;
  // שגיאה אחרת (למשל RLS) פירושה שהטבלה כן קיימת.
  return true;
}

async function checkConnection() {
  const { error } = await admin.from("profiles").select("id").limit(1);
  if (error && MISSING_TABLE_CODES.has(error.code)) {
    console.log("\n⚠️  החיבור עובד, אך הטבלאות טרם נוצרו. יש להריץ את המיגרציות.");
    return "empty";
  }
  if (error) {
    console.log(`\n❌ החיבור נכשל: ${error.message}`);
    if (error.message.includes("Invalid API key")) console.log("   נראה שהמפתח אינו נכון או שייך לפרויקט אחר.");
    return "error";
  }
  console.log("\n✅ החיבור עובד וההרשאות תקינות.");
  return "ok";
}

async function verify() {
  console.log("\n=== טבלאות ===");
  const missingTables = [];
  for (const name of expectedTables) {
    const exists = await tableExists(name);
    console.log(`  ${exists ? "✓" : "✗"} ${name}`);
    if (!exists) missingTables.push(name);
  }

  console.log("\n=== פונקציות ===");
  const missingFunctions = [];
  for (const name of expectedFunctions) {
    // קריאה עם ארגומנטים שגויים מחזירה שגיאת חתימה אם הפונקציה קיימת,
    // ושגיאת "not found" אם היא אינה קיימת.
    const { error } = await admin.rpc(name, {});
    const exists = !error || !/could not find|does not exist/i.test(error.message);
    console.log(`  ${exists ? "✓" : "✗"} ${name}`);
    if (!exists) missingFunctions.push(name);
  }

  console.log("\n=== RLS: קריאה אנונימית ===");
  const { error: anonProfiles } = await anon.from("profiles").select("id").limit(1);
  if (anonProfiles) console.log("  ✓ profiles חסום ל-anon");
  else console.log("  ✗ profiles נקרא ל-anon — RLS לא נאכף!");

  const { error: anonLeads } = await anon.from("leads").select("id").limit(1);
  if (anonLeads) console.log("  ✓ leads חסום ל-anon");
  else console.log("  ✗ leads נקרא ל-anon — RLS לא נאכף!");

  console.log("\n=== Storage ===");
  const { data: buckets } = await admin.storage.listBuckets();
  const media = (buckets || []).find((bucket) => bucket.id === "card-media");
  console.log(`  ${media ? "✓" : "✗"} bucket card-media${media ? ` (public: ${media.public})` : ""}`);

  const ready = !missingTables.length && !missingFunctions.length;
  console.log(`\n${ready ? "✅ המסד מוכן." : "⚠️  חסרים אובייקטים — יש להריץ את המיגרציות."}`);
  if (missingTables.length) console.log(`   טבלאות חסרות: ${missingTables.join(", ")}`);
  if (missingFunctions.length) console.log(`   פונקציות חסרות: ${missingFunctions.join(", ")}`);
  return ready;
}

function migrationInstructions() {
  const dir = "supabase/migrations";
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  console.log("\n=== מיגרציות להרצה, לפי הסדר ===\n");
  files.forEach((name, index) => {
    const size = (fs.statSync(path.join(dir, name)).size / 1024).toFixed(1);
    console.log(`  ${index + 1}. ${name}  (${size}KB)`);
  });

  console.log("\nשתי דרכים להרצה:\n");
  console.log("א. דרך ה-CLI (מומלץ) — דורש חיבור חד־פעמי לפרויקט:");
  console.log("     npx supabase login");
  console.log("     npx supabase link --project-ref <PROJECT_REF>");
  console.log("     npx supabase db push\n");
  console.log("ב. דרך הדשבורד — SQL Editor, מדביקים כל קובץ לפי הסדר ומריצים.\n");
  console.log("PROJECT_REF הוא החלק מה-URL:  https://<PROJECT_REF>.supabase.co\n");
  console.log("אחרי ההרצה:  node scripts/db-setup.mjs verify\n");
}

const status = await checkConnection();

if (command === "check") {
  process.exit(status === "ok" ? 0 : 1);
}

if (command === "verify") {
  const ready = await verify();
  process.exit(ready ? 0 : 1);
}

if (command === "migrate") {
  migrationInstructions();
  if (status !== "error") await verify();
  process.exit(0);
}

console.log(`\nפקודה לא מוכרת: ${command}. אפשר: check | verify | migrate\n`);
process.exit(1);
