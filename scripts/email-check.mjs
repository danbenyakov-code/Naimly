/**
 * בדיקת SMTP: חיבור, אימות ושליחת מייל בדיקה אמיתי.
 *
 * שימוש:
 *   node scripts/email-check.mjs                 # בדיקת חיבור בלבד
 *   node scripts/email-check.mjs --send you@x.com  # שליחת מייל בדיקה
 *
 * הסקריפט אינו מדווח על הצלחה שלא קרתה — כישלון מוצג עם הסיבה המדויקת.
 */
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

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

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;
const from = process.env.SMTP_FROM || user;

const sendIndex = process.argv.indexOf("--send");
const recipient = sendIndex > -1 ? process.argv[sendIndex + 1] : "";

console.log("\n=== הגדרות SMTP ===");
console.log("  SMTP_HOST     ", host || "✗ חסר");
console.log("  SMTP_PORT     ", port);
console.log("  SMTP_USER     ", user || "✗ חסר");
console.log("  SMTP_PASSWORD ", password ? `✓ (${password.length} תווים)` : "✗ חסר");
console.log("  SMTP_FROM     ", from || "✗ חסר");

if (!host || !user || !password) {
  console.log("\n❌ חסרות הגדרות. יש להוסיף ל-.env.local:\n");
  console.log("  SMTP_HOST=smtp.gmail.com");
  console.log("  SMTP_PORT=587");
  console.log("  SMTP_USER=info.naimly@gmail.com");
  console.log("  SMTP_PASSWORD=<סיסמת אפליקציה בת 16 תווים>");
  console.log("  SMTP_FROM=info.naimly@gmail.com\n");
  console.log("ל-Gmail נדרשת סיסמת אפליקציה, לא סיסמת החשבון:");
  console.log("  myaccount.google.com → Security → 2-Step Verification → App passwords\n");
  process.exit(1);
}

// Gmail דוחה את סיסמת החשבון הרגילה. סיסמת אפליקציה היא 16 תווים.
if (host.includes("gmail") && password.replace(/\s/g, "").length !== 16) {
  console.log(`\n⚠️  אזהרה: סיסמת אפליקציה של Gmail היא בת 16 תווים, וכאן יש ${password.replace(/\s/g, "").length}.`);
  console.log("   סיסמת החשבון הרגילה תידחה על ידי Gmail.\n");
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass: password.replace(/\s/g, "") },
});

console.log("\n=== בדיקת חיבור ואימות ===");
try {
  await transporter.verify();
  console.log("  ✅ החיבור והאימות הצליחו.");
} catch (error) {
  console.log("  ❌ נכשל.");
  console.log(`     ${error.message}`);
  const message = String(error.message).toLowerCase();
  if (message.includes("invalid login") || message.includes("username and password")) {
    console.log("\n     Gmail דחה את פרטי ההתחברות. בדרך כלל אחת מאלה:");
    console.log("     • משתמשים בסיסמת החשבון במקום בסיסמת אפליקציה");
    console.log("     • אימות דו-שלבי אינו מופעל בחשבון (נדרש לסיסמת אפליקציה)");
    console.log("     • הסיסמה הודבקה עם רווחים — יש להסיר אותם");
  }
  if (message.includes("etimedout") || message.includes("econnrefused")) {
    console.log("\n     החיבור נחסם. ייתכן שחומת אש חוסמת את הפורט, או שהפורט שגוי.");
    console.log("     587 = STARTTLS (מומלץ), 465 = SSL.");
  }
  process.exit(1);
}

if (!recipient) {
  console.log("\nלשליחת מייל בדיקה אמיתי:");
  console.log("  node scripts/email-check.mjs --send your@email.com\n");
  process.exit(0);
}

console.log(`\n=== שליחת מייל בדיקה אל ${recipient} ===`);
try {
  const info = await transporter.sendMail({
    from: `"NAIMLY" <${from}>`,
    to: recipient,
    subject: "בדיקת SMTP — NAIMLY",
    text: "אם ההודעה הזו הגיעה, הגדרות ה-SMTP תקינות.",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:16px">
      <h2 style="margin:0 0 8px">בדיקת SMTP הצליחה ✅</h2>
      <p style="color:#68758a;line-height:1.6">אם ההודעה הזו הגיעה, המערכת יכולה לשלוח התראות לידים, אישורי תשלום ופניות.</p>
      <p style="color:#8b96a8;font-size:12px">נשלח מ-${from} · ${new Date().toLocaleString("he-IL")}</p>
    </div>`,
  });
  console.log(`  ✅ נשלח. messageId: ${info.messageId}`);
  console.log(`     accepted: ${info.accepted.join(", ") || "—"}`);
  if (info.rejected?.length) console.log(`     rejected: ${info.rejected.join(", ")}`);
  console.log("\nכדאי לבדוק גם בתיקיית הספאם.\n");
} catch (error) {
  console.log("  ❌ השליחה נכשלה.");
  console.log(`     ${error.message}\n`);
  process.exit(1);
}
