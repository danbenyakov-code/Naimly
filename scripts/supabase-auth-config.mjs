/**
 * החלת הגדרות Supabase Auth דרך ה-Management API:
 * תבניות המייל (עם {{ .Token }}), פרטי ה-SMTP, ואורך/תוקף הקוד.
 *
 * מחליף את ההדבקה הידנית בדשבורד תחת Authentication → Emails.
 *
 * שימוש:
 *   node scripts/supabase-auth-config.mjs           # הצגת ההפרשים בלבד
 *   node scripts/supabase-auth-config.mjs --apply   # כתיבה בפועל
 *
 * הסקריפט קורא בחזרה אחרי הכתיבה ומשווה. הוא לא מדווח על הצלחה
 * שלא אומתה מול השרת.
 */
import fs from "node:fs";
import path from "node:path";

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
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!ref) {
  console.error("\n❌ לא זוהה מזהה הפרויקט (NEXT_PUBLIC_SUPABASE_URL או SUPABASE_PROJECT_REF).\n");
  process.exit(1);
}

if (!token) {
  console.error(`
❌ חסר SUPABASE_ACCESS_TOKEN.

  1. https://supabase.com/dashboard/account/tokens → Generate new token
  2. ב-.env.local (מסונן מ-Git):  SUPABASE_ACCESS_TOKEN=sbp_...
  3. שוב:  npm run supabase:auth
`);
  process.exit(1);
}

// ── מה שהקוד מצהיר עליו, כדי שהדשבורד לא יסתור אותו ──────────────────────────
const OTP_LENGTH = 6;      // src/lib/auth-schema.ts
const OTP_TTL_MINUTES = 10; // ההודעה למשתמש מבטיחה 10 דקות

const templateDir = path.join("docs", "email-templates");
function template(name) {
  const full = path.join(templateDir, name);
  if (!fs.existsSync(full)) {
    console.error(`\n❌ חסרה התבנית ${full}\n`);
    process.exit(1);
  }
  const html = fs.readFileSync(full, "utf8");
  if (!html.includes("{{ .Token }}")) {
    console.error(`\n❌ ${full} אינה מכילה {{ .Token }} — בלעדיו הקוד לא יישלח.\n`);
    process.exit(1);
  }
  return html;
}

const desired = {
  mailer_subjects_confirmation: "קוד האימות שלך ל-Naimly",
  mailer_templates_confirmation_content: template("confirm-signup.html"),
  mailer_subjects_recovery: "איפוס הסיסמה שלך ב-Naimly",
  mailer_templates_recovery_content: template("reset-password.html"),
  mailer_otp_length: OTP_LENGTH,
  mailer_otp_exp: OTP_TTL_MINUTES * 60,
};

const smtp = {
  smtp_host: process.env.SMTP_HOST,
  smtp_port: process.env.SMTP_PORT,
  smtp_user: process.env.SMTP_USER,
  smtp_pass: process.env.SMTP_PASSWORD,
  smtp_admin_email: process.env.SMTP_FROM || process.env.SMTP_USER,
  smtp_sender_name: "Naimly",
};

const missingSmtp = Object.entries(smtp).filter(([, value]) => !value).map(([key]) => key);
if (missingSmtp.length) {
  console.error(`\n⚠️  דילוג על הגדרות SMTP — חסרים ב-.env.local: ${missingSmtp.join(", ")}`);
  console.error("   התבניות עדיין יוחלו, אבל המיילים יישלחו בשרת המובנה המוגבל של Supabase.\n");
} else {
  Object.assign(desired, smtp);
}

const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function request(method, body) {
  const response = await fetch(endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (!response.ok) {
    console.error(`\n❌ ${method} נכשל (HTTP ${response.status}): ${text.slice(0, 400)}`);
    if (response.status === 401) console.error("   הטוקן אינו תקף. יש להנפיק חדש.");
    if (response.status === 403) console.error("   לטוקן אין הרשאה לפרויקט הזה.");
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
}

/** סוד לעולם לא נכתב ללוג — רק אורכו. */
const show = (key, value) =>
  key === "smtp_pass" ? `(${String(value).length} תווים)`
  : typeof value === "string" && value.length > 60 ? `${value.length} תווים של HTML`
  : String(value);

console.log(`\n=== הגדרות Auth בפרויקט ${ref} ===\n`);
const current = await request("GET");

const changes = Object.entries(desired).filter(([key, value]) => String(current[key] ?? "") !== String(value));

if (!changes.length) {
  console.log("✅ כל ההגדרות כבר תואמות. אין מה לשנות.\n");
  process.exit(0);
}

for (const [key, value] of changes) {
  console.log(`  ${key}`);
  console.log(`     מ:  ${show(key, current[key] ?? "(ריק)")}`);
  console.log(`     ל:  ${show(key, value)}`);
}

if (!apply) {
  console.log(`\n${changes.length} שינויים ממתינים. להחלה:  npm run supabase:auth -- --apply\n`);
  process.exit(0);
}

console.log("\nכותב…");
await request("PATCH", Object.fromEntries(changes));

// אימות: קריאה חוזרת והשוואה. בלי זה אין ראיה שהשינוי נתפס.
const after = await request("GET");
const failed = changes.filter(([key, value]) => String(after[key] ?? "") !== String(value));

if (failed.length) {
  console.error(`\n❌ ${failed.length} הגדרות לא נשמרו: ${failed.map(([key]) => key).join(", ")}`);
  process.exit(1);
}

console.log(`\n✅ ${changes.length} הגדרות נכתבו ואומתו מול השרת.`);
console.log("   נותר לבדוק הרשמה אמיתית ולוודא שהמייל מכיל קוד בן 6 ספרות.\n");
