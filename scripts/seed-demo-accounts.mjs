/**
 * חשבונות בדיקה — אחד לכל מסלול בתשלום.
 *
 * מטרתם לאפשר בדיקה של הנעילות בפועל: מה נעול בבסיסי, מה נפתח במקצועי,
 * ומה מוסיף פרימיום. בלי חשבון אמיתי לכל מסלול, הנעילות נבדקות רק
 * בקוד — וזה בדיוק סוג הבדיקה שלא תופסת פערים בין השכבות.
 *
 * הערה חשובה על ההתנסות: danbenyakov+1@gmail.com מתנרמל ל-
 * danbenyakov@gmail.com לצורך REQ-014, ולכן החשבונות האלה **אינם
 * יכולים להתחיל התנסות** — הכתובת כבר מימשה אחת. זו ההתנהגות הנכונה,
 * ולכן המסלול מופעל להם ישירות דרך activate_subscription.
 *
 * שימוש:
 *   node scripts/seed-demo-accounts.mjs            # מה ייווצר
 *   node scripts/seed-demo-accounts.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
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

const apply = process.argv.includes("--apply");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=danbenyakov@gmail.com").slice(7);
const [localPart, domain] = base.split("@");

const accounts = [
  { suffix: "1", plan: "basic", name: "בדיקה — מסלול בסיסי" },
  { suffix: "2", plan: "pro", name: "בדיקה — מסלול מקצועי" },
  { suffix: "3", plan: "premium", name: "בדיקה — מסלול פרימיום" },
].map((entry) => ({ ...entry, email: `${localPart}+${entry.suffix}@${domain}` }));

/**
 * סיסמה אקראית חזקה לכל חשבון.
 *
 * לא סיסמה קבועה בקוד: חשבון בדיקה עם סיסמה ידועה שנדחפת ל-Git הוא
 * דלת פתוחה, גם אם הוא "רק לבדיקות".
 */
function strongPassword() {
  const raw = randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "");
  return `Qa!${raw.slice(0, 12)}9`;
}

console.log(`\n=== ${accounts.length} חשבונות בדיקה ===\n`);
for (const account of accounts) {
  const { data } = await admin.from("profiles").select("id").eq("email", account.email).maybeSingle();
  console.log(`  ${account.email.padEnd(30)} ${account.plan.padEnd(9)} ${data ? "קיים — יעודכן" : "חדש — ייווצר"}`);
}

if (!apply) {
  console.log("\nלהחלה:  node scripts/seed-demo-accounts.mjs --apply\n");
  process.exit(0);
}

const created = [];
let failures = 0;

for (const account of accounts) {
  const password = strongPassword();

  const { data: existing } = await admin.from("profiles").select("id").eq("email", account.email).maybeSingle();
  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.name },
    });
    if (error || !data.user) {
      console.error(`  ✗ ${account.email}: ${error?.message || "לא נוצר"}`);
      failures += 1;
      continue;
    }
    userId = data.user.id;
  } else {
    // חשבון קיים: איפוס סיסמה כדי שהפרטים שיודפסו יהיו נכונים.
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error(`  ✗ ${account.email}: ${error.message}`);
      failures += 1;
      continue;
    }
  }

  await admin.from("profiles").update({ full_name: account.name, updated_at: new Date().toISOString() }).eq("id", userId);

  /*
   * הפעלת המסלול ישירות. אלה חשבונות בדיקה שנועדו לבדוק נעילות, ולכן
   * הם צריכים להיות על מסלול בתשלום פעיל — לא בהתנסות.
   */
  /*
   * סימון בחירת המסלול. activate_subscription מפעיל את המנוי אך אינו
   * מסמן בחירה, ו-effective_plan מחזיר none כל עוד plan_selected_at
   * ריק — כלומר החשבון היה "פעיל" ובכל זאת נעול לחלוטין.
   */
  await admin.rpc("mark_plan_selected", { target_user: userId, target_plan: account.plan });

  const { error: activateError } = await admin.rpc("activate_subscription", {
    target_user: userId,
    target_plan: account.plan,
    months: 12,
    actor: null,
  });
  if (activateError) {
    console.error(`  ✗ ${account.email}: הפעלת המסלול נכשלה — ${activateError.message}`);
    failures += 1;
    continue;
  }

  // תיעוד הסכמה, כדי שהחשבון לא ייחסם בשער האישור בכניסה הראשונה.
  await admin.rpc("record_legal_acceptance", {
    target_user: userId,
    acceptance_context: "plan",
    accepted_version: "2026-09-14",
    client_ip: null,
    client_agent: "seed-demo-accounts",
    target_plan: account.plan,
  });

  created.push({ ...account, password });
  console.log(`  ✓ ${account.email.padEnd(30)} ${account.plan}`);
}

if (created.length) {
  console.log("\n=== פרטי כניסה ===");
  console.log("הסיסמאות מוצגות פעם אחת בלבד ואינן נשמרות בשום קובץ.\n");
  for (const account of created) {
    console.log(`  ${account.email}`);
    console.log(`  סיסמה: ${account.password}`);
    console.log(`  מסלול: ${account.plan}\n`);
  }
}

console.log(failures === 0 ? "✅ כל החשבונות מוכנים.\n" : `❌ ${failures} כשלים.\n`);
process.exit(failures === 0 ? 0 : 1);
