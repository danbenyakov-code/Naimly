/**
 * שליחת דוגמה של מייל תיעוד אישור התנאים.
 *
 * המייל הזה נשלח בייצור אחרי כל אישור תנאים, והוא ראיה משפטית. הדרך
 * היחידה לדעת שהוא מגיע קריא, ב-RTL ועם כל השדות — היא לשלוח אותו
 * ולהסתכל. תצוגה מקדימה בקוד אינה מוכיחה כלום על מה ש-Gmail מציג.
 *
 * שימוש:
 *   node scripts/legal-email-preview.mjs            # ליעד ההתראות המוגדר
 *   node scripts/legal-email-preview.mjs you@x.com  # ליעד אחר
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

const { sendLegalAcceptanceNotification } = await import("../src/lib/email.ts");
const { adminNotificationEmail, plans } = await import("../src/lib/config.ts");
const { LEGAL_VERSION, bindingDocumentIds } = await import("../src/lib/legal.ts");

const target = process.argv[2] || adminNotificationEmail;
const pro = plans.find((plan) => plan.id === "pro");

console.log(`\nשולח דוגמת תיעוד אל ${target}...\n`);

const result = await sendLegalAcceptanceNotification({
  to: target,
  customerName: "לקוח לדוגמה",
  customerEmail: "customer@example.com",
  customerPhone: "050-000-0000",
  context: "plan",
  contextLabel: "בחירת מסלול בתשלום (דוגמה)",
  planName: pro.name,
  cycle: "annual",
  amount: pro.price * 10,
  documentVersion: LEGAL_VERSION,
  documents: bindingDocumentIds,
  acceptedAt: new Date().toISOString(),
  ip: "203.0.113.10",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
});

// אין מדווחים על הצלחה שלא קרתה.
if (result.sent) {
  console.log(`✅ נשלח דרך ${result.via}. יש לבדוק בתיבה שהיישור ימין-לשמאל וכל השדות מופיעים.\n`);
} else {
  console.log(`❌ לא נשלח. סיבה: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}\n`);
  process.exitCode = 1;
}
