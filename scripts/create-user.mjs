/**
 * יצירת משתמש במערכת מהטרמינל — לבדיקות או לפתיחת חשבון ראשון של מנהל.
 *
 * דורש בסביבה:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (נטענים אוטומטית מ-.env.local או .env אם קיימים)
 *
 * שימוש:
 *   node scripts/create-user.mjs --email a@b.com --password 'Xy!23456789' --name "שם מלא" --role admin --plan premium
 *
 * דגלים:
 *   --role   customer | admin          (ברירת מחדל: customer)
 *   --plan   trial | basic | pro | premium  (ברירת מחדל: trial)
 *   --months מספר חודשי מנוי           (ברירת מחדל: 12)
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── טעינת משתני סביבה מקובץ, בלי תלות חיצונית ──────────────────────────────
for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, "");
  args[key] = process.argv[index + 1];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("\nחסרים משתני סביבה.");
  console.error("נדרש: NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY");
  console.error("אפשר להוסיף אותם ל-.env.local בשורש הפרויקט.\n");
  process.exit(1);
}

const email = args.email;
const password = args.password;
const fullName = args.name || "משתמש בדיקה";
const role = args.role === "admin" ? "admin" : "customer";
const plan = ["trial", "basic", "pro", "premium"].includes(args.plan) ? args.plan : "trial";
const months = Number(args.months) || 12;

if (!email || !password) {
  console.error("\nחסר --email או --password.\n");
  console.error("דוגמה:");
  console.error("  node scripts/create-user.mjs --email test@naimly.co.il --password 'Test!2345678' --name 'בודק מערכת' --role admin --plan premium\n");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

console.log(`\nיוצר משתמש ${email} ...`);

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

let userId = created?.user?.id;

if (createError) {
  if (!createError.message?.toLowerCase().includes("already")) {
    console.error("יצירת המשתמש נכשלה:", createError.message);
    process.exit(1);
  }
  // המשתמש כבר קיים — מאתרים אותו ומעדכנים סיסמה.
  console.log("המשתמש כבר קיים. מעדכן סיסמה והרשאות...");
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    console.error("לא הצלחנו לאתר את המשתמש הקיים.");
    process.exit(1);
  }
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { full_name: fullName } });
}

// הטריגר handle_new_user יוצר פרופיל ומנוי; משלימים את מה שחסר.
await admin.from("profiles").upsert(
  { id: userId, email, full_name: fullName, role, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { onConflict: "id" },
);

if (plan === "trial") {
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: "trial",
      status: "trialing",
      provider: "trial",
      current_period_end: new Date(Date.now() + 14 * 86400000).toISOString(),
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
} else {
  const { error } = await admin.rpc("activate_subscription", { target_user: userId, target_plan: plan, months, actor: null });
  if (error) {
    console.error("הפעלת המסלול נכשלה:", error.message);
    console.error("ודאו שהמיגרציה 004 הורצה.");
    process.exit(1);
  }
}

console.log("\n✓ המשתמש מוכן\n");
console.log(`  אימייל:  ${email}`);
console.log(`  סיסמה:   ${password}`);
console.log(`  שם:      ${fullName}`);
console.log(`  הרשאה:   ${role === "admin" ? "מנהל מערכת" : "לקוח"}`);
console.log(`  מסלול:   ${plan}${plan === "trial" ? " (14 יום)" : ` (${months} חודשים)`}`);
console.log(`\n  כניסה:   /login\n`);
