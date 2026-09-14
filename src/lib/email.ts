import nodemailer, { type Transporter } from "nodemailer";
import { brand, billingCycleLabel, type BillingCycle } from "@/lib/config";

/**
 * שליחת מיילים דרך SMTP.
 *
 * שני מסלולים, לפי מה שמוגדר:
 *   1. SMTP ישיר (Gmail או כל ספק אחר) — SMTP_HOST ו-SMTP_PASSWORD.
 *   2. Adapter חיצוני (Make/Zapier/שרת תיווך) — EMAIL_API_URL.
 *
 * כשאף אחד אינו מוגדר, הפונקציות מחזירות `sent: false` עם סיבה מפורשת.
 * הן לעולם אינן מדווחות על הצלחה שלא קרתה.
 *
 * הערה: מיילי האימות (OTP) נשלחים על ידי Supabase ולא מכאן. יש להגדיר
 * את אותו SMTP גם ב-Supabase → Authentication → SMTP Settings.
 */

export type EmailResult =
  | { sent: true; via: "smtp" | "api" }
  | { sent: false; reason: "not_configured" | "no_recipient" | "provider_error"; detail?: string };

const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || "";
const smtpPassword = process.env.SMTP_PASSWORD || "";
const smtpFrom = process.env.SMTP_FROM || smtpUser;

export const isSmtpConfigured = Boolean(smtpHost && smtpUser && smtpPassword);
export const isEmailApiConfigured = Boolean(process.env.EMAIL_API_URL && process.env.EMAIL_API_SECRET);
export const isEmailConfigured = isSmtpConfigured || isEmailApiConfigured;

let transporter: Transporter | null = null;

function getTransporter() {
  if (!isSmtpConfigured) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    // 465 הוא SSL ישיר; 587 מתחיל בטקסט ומשדרג ל-TLS.
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });
  return transporter;
}

/** בדיקת חיבור. משמשת את סקריפט האימות ולא נקראת בזרימה רגילה. */
export async function verifySmtp(): Promise<EmailResult> {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "not_configured" };
  try {
    await mailer.verify();
    return { sent: true, via: "smtp" };
  } catch (error) {
    return { sent: false, reason: "provider_error", detail: error instanceof Error ? error.message : String(error) };
  }
}

async function send(input: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<EmailResult> {
  if (!input.to) return { sent: false, reason: "no_recipient" };

  const mailer = getTransporter();
  if (mailer) {
    try {
      await mailer.sendMail({
        from: `"${brand.name}" <${smtpFrom}>`,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html,
        /*
         * base64 לחלקי הטקסט: משמר בתי UTF-8 במקום quoted-printable
         * שאיבד תווים עבריים והפך אותם לסימני שאלה.
         *
         * לא לגעת כאן ב-headers או ב-encoding: headers.Content-Type דורס
         * את ה-Content-Type של ההודעה כולה ומוחק את מבנה ה-multipart,
         * ואז הלקוח מציג את המקור כטקסט גולמי במקום מייל.
         */
        textEncoding: "base64",
      });
      return { sent: true, via: "smtp" };
    } catch (error) {
      return { sent: false, reason: "provider_error", detail: error instanceof Error ? error.message : String(error) };
    }
  }

  if (isEmailApiConfigured) {
    try {
      const response = await fetch(process.env.EMAIL_API_URL!, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_SECRET}` },
        body: JSON.stringify({ to: input.to, subject: input.subject, html: input.html, text: input.text }),
        cache: "no-store",
      });
      return response.ok ? { sent: true, via: "api" } : { sent: false, reason: "provider_error", detail: `HTTP ${response.status}` };
    } catch (error) {
      return { sent: false, reason: "provider_error", detail: error instanceof Error ? error.message : String(error) };
    }
  }

  return { sent: false, reason: "not_configured" };
}

// ─────────────────────────────────────────────────────────────────────────────
// תבניות
// ─────────────────────────────────────────────────────────────────────────────

/** מנטרל HTML בערכים שמגיעים ממשתמשים, לפני הכנסה לתבנית. */
function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * מעטפת המייל.
 *
 * Gmail ולקוחות רבים מסירים את תגי <html> ו-<body> ומשתילים רק את
 * התוכן בתוך המיכל שלהם. לכן dir="rtl" ברמת ה-<html> נעלם, וכל
 * הטקסט נראה מיושר לשמאל. הכיוון והיישור מוגדרים גם על כל div פנימי,
 * inline, כי זה מה ששורד את החיתוך.
 */
/**
 * מעטפת המייל, בנויה על טבלאות.
 *
 * לקוחות דואר — Gmail בראשם — מסירים <html> ו-<body>, מזריקים CSS
 * משלהם ודורסים text-align על <div>. תכונות HTML על <table> ו-<td>
 * (dir ו-align) שורדות את זה, ולכן הפריסה נשענת עליהן ולא על CSS.
 * זו הסיבה שכל מייל שיווקי רציני בנוי מטבלאות ב-2026.
 */
function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body dir="rtl" style="margin:0;padding:0;background:#f4f6fa">
<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fa;direction:rtl">
  <tr>
    <td align="center" dir="rtl" style="padding:24px 16px;direction:rtl">
      <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;direction:rtl;font-family:Arial,Helvetica,sans-serif;color:#0b1020">
        <tr>
          <td dir="rtl" align="right" style="background:#0b1020;border-radius:18px 18px 0 0;padding:20px 24px;text-align:right;direction:rtl">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">${escapeHtml(brand.name)}</span>
          </td>
        </tr>
        <tr>
          <td dir="rtl" align="right" style="background:#ffffff;border-radius:0 0 18px 18px;padding:24px;text-align:right;direction:rtl">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td dir="rtl" align="center" style="padding:16px 0 0;text-align:center;font-size:12px;color:#8b96a8;direction:rtl">
            ${escapeHtml(brand.name)} &middot; <a href="${brand.siteUrl}" style="color:#6d4aff">${escapeHtml(brand.siteUrl)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

/** התראה לבעל הכרטיס על פנייה חדשה. */
export async function sendLeadNotification(input: {
  to: string;
  businessName: string;
  cardSlug?: string;
  lead: { name: string; phone: string; email: string; message: string };
}): Promise<EmailResult> {
  const { lead } = input;
  const rows = [
    ["שם", lead.name],
    ["טלפון", lead.phone],
    ["אימייל", lead.email],
  ].filter(([, value]) => Boolean(value));

  const html = layout(
    `פנייה חדשה מהכרטיס של ${input.businessName}`,
    `<h1 dir="rtl" align="right" style="margin:0 0 8px;font-size:20px;direction:rtl;text-align:right">פנייה חדשה 🎉</h1>
     <p dir="rtl" align="right" style="margin:0 0 20px;color:#68758a;line-height:1.6;direction:rtl;text-align:right">התקבלה פנייה חדשה מהכרטיס של ${escapeHtml(input.businessName)}.</p>
     <table dir="rtl" style="width:100%;border-collapse:collapse;margin-bottom:16px;direction:rtl">
       ${rows.map(([label, value]) => `<tr>
         <td dir="rtl" align="right" style="padding:8px 0;color:#8b96a8;font-size:13px;width:80px;text-align:right">${escapeHtml(label)}</td>
         <td dir="rtl" align="right" style="padding:8px 0;font-weight:700;text-align:right">${escapeHtml(value)}</td>
       </tr>`).join("")}
     </table>
     ${lead.message ? `<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl"><tr><td dir="rtl" align="right" style="background:#f6f7fb;border-radius:12px;padding:14px;line-height:1.7;direction:rtl;text-align:justify;text-align-last:right">${escapeHtml(lead.message)}</td></tr></table>` : ""}
     <a href="${brand.siteUrl}/dashboard/leads" style="display:inline-block;margin-top:20px;background:#6d4aff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700">
       צפייה בכל הפניות
     </a>`,
  );

  const text = [
    `פנייה חדשה מהכרטיס של ${input.businessName}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    lead.message ? `\nהודעה:\n${lead.message}` : "",
    "",
    `${brand.siteUrl}/dashboard/leads`,
  ].filter(Boolean).join("\n");

  return send({
    to: input.to,
    subject: `פנייה חדשה מהכרטיס של ${input.businessName}`,
    html,
    text,
    // מענה ישיר ללקוח, כשהשאיר אימייל.
    replyTo: lead.email || undefined,
  });
}

/** התראה למנהל על בקשת תשלום חדשה. */
export async function sendPaymentRequestNotification(input: {
  to: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  amount: number;
  reference: string;
  cycle?: BillingCycle;
}): Promise<EmailResult> {
  // מנהל שרואה רק סכום אינו יודע לכמה זמן להפעיל את המנוי.
  const cycleText = billingCycleLabel[input.cycle || "monthly"];
  const html = layout(
    "בקשת תשלום חדשה",
    `<h1 dir="rtl" align="right" style="margin:0 0 8px;font-size:20px;direction:rtl;text-align:right">בקשת תשלום חדשה</h1>
     <p dir="rtl" align="right" style="margin:0 0 20px;color:#68758a;line-height:1.6;direction:rtl;text-align:right">${escapeHtml(input.customerName)} ביקש להפעיל מסלול ${escapeHtml(input.planName)}.</p>
     <table dir="rtl" style="width:100%;border-collapse:collapse;margin-bottom:16px;direction:rtl">
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px;width:90px">לקוח</td><td dir="rtl" align="right" style="padding:8px 0;font-weight:700;text-align:right">${escapeHtml(input.customerName)}</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">אימייל</td><td style="padding:8px 0;font-weight:700" dir="ltr">${escapeHtml(input.customerEmail)}</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">מסלול</td><td dir="rtl" align="right" style="padding:8px 0;font-weight:700;text-align:right">${escapeHtml(input.planName)} — ${input.amount} ש״ח</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">מחזור חיוב</td><td dir="rtl" align="right" style="padding:8px 0;font-weight:700;text-align:right">${escapeHtml(cycleText)}</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">אסמכתא</td><td style="padding:8px 0;font-weight:700;font-family:monospace" dir="ltr">${escapeHtml(input.reference)}</td></tr>
     </table>
     <a href="${brand.siteUrl}/admin/approvals" style="display:inline-block;margin-top:8px;background:#6d4aff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700">
       מעבר לאישורים
     </a>`,
  );

  const text = [
    "בקשת תשלום חדשה",
    "",
    `לקוח: ${input.customerName}`,
    `אימייל: ${input.customerEmail}`,
    `מסלול: ${input.planName} — ${input.amount} ש״ח`,
    `מחזור חיוב: ${cycleText}`,
    `אסמכתא: ${input.reference}`,
    "",
    `${brand.siteUrl}/admin/approvals`,
  ].join("\n");

  return send({ to: input.to, subject: `בקשת תשלום — ${input.planName} — ${input.reference}`, html, text });
}

/** אישור ללקוח שהמסלול הופעל. */
export async function sendPlanActivatedNotification(input: {
  to: string;
  customerName: string;
  planName: string;
  months: number;
}): Promise<EmailResult> {
  const html = layout(
    "המסלול הופעל",
    `<h1 dir="rtl" align="right" style="margin:0 0 8px;font-size:20px;direction:rtl;text-align:right">המסלול שלך פעיל 🎉</h1>
     <p style="margin:0 0 16px;color:#68758a;line-height:1.6">
       היי ${escapeHtml(input.customerName)}, אישרנו את התשלום והמסלול
       <strong>${escapeHtml(input.planName)}</strong> פעיל למשך ${input.months} חודשים.
     </p>
     <p dir="rtl" align="right" style="margin:0 0 20px;color:#68758a;line-height:1.6;direction:rtl;text-align:right">הכרטיס שלך חזר לאוויר וכל היכולות של המסלול פתוחות.</p>
     <a href="${brand.siteUrl}/dashboard" style="display:inline-block;background:#6d4aff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700">
       מעבר לאזור האישי
     </a>`,
  );

  const text = [
    `היי ${input.customerName},`,
    "",
    `אישרנו את התשלום. המסלול ${input.planName} פעיל למשך ${input.months} חודשים.`,
    "הכרטיס שלך חזר לאוויר.",
    "",
    `${brand.siteUrl}/dashboard`,
  ].join("\n");

  return send({ to: input.to, subject: `המסלול ${input.planName} הופעל`, html, text });
}

/** אישור לשולח טופס יצירת הקשר. */
export async function sendContactAcknowledgement(input: {
  to: string;
  name: string;
  topicLabel: string;
}): Promise<EmailResult> {
  const html = layout(
    "קיבלנו את הפנייה",
    `<h1 dir="rtl" align="right" style="margin:0 0 8px;font-size:20px;direction:rtl;text-align:right">קיבלנו את הפנייה שלך</h1>
     <p style="margin:0 0 16px;color:#68758a;line-height:1.6">
       היי ${escapeHtml(input.name)}, הפנייה בנושא <strong>${escapeHtml(input.topicLabel)}</strong> התקבלה.
       נחזור אליך בדרך כלל תוך יום עסקים אחד.
     </p>`,
  );

  const text = `היי ${input.name},\n\nקיבלנו את הפנייה בנושא ${input.topicLabel}. נחזור אליך תוך יום עסקים.\n\n${brand.name}`;

  return send({ to: input.to, subject: `קיבלנו את הפנייה שלך — ${input.topicLabel}`, html, text });
}

/**
 * תיעוד הסכמה למסמכים המשפטיים, למנהל המערכת.
 *
 * הסכמה שנרשמה במסד אך איש אינו יודע עליה היא ראיה שצריך לחפש אותה.
 * המייל הזה הופך כל אישור לרשומה שמגיעה מעצמה לתיבת המנהל, עם כל מה
 * שנדרש כדי להוכיח מי אישר, מה בדיוק אושר, מתי ומאיפה.
 *
 * נשלח בכל אחד משלושת המסלולים: בחירת התנסות, בחירת מסלול בתשלום,
 * ואישור מחדש לאחר עדכון גרסה.
 */
export async function sendLegalAcceptanceNotification(input: {
  to: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  context: "signup" | "plan" | "re_accept";
  contextLabel: string;
  planName: string;
  cycle?: BillingCycle;
  amount?: number;
  documentVersion: string;
  documents: string[];
  acceptedAt: string;
  ip?: string;
  userAgent?: string;
}): Promise<EmailResult> {
  const when = new Date(input.acceptedAt);
  const stamp = Number.isNaN(when.getTime())
    ? input.acceptedAt
    : when.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "full", timeStyle: "medium" });

  const billingLine = input.amount
    ? `${input.planName} — ${input.amount} ש״ח · ${billingCycleLabel[input.cycle || "monthly"]}`
    : input.planName;

  const rows: Array<[string, string, "rtl" | "ltr"]> = [
    ["לקוח", input.customerName, "rtl"],
    ["אימייל", input.customerEmail, "ltr"],
    ["טלפון", input.customerPhone || "לא נמסר", "ltr"],
    ["הקשר האישור", input.contextLabel, "rtl"],
    ["מסלול", billingLine, "rtl"],
    ["גרסת המסמכים", input.documentVersion, "ltr"],
    ["מסמכים שאושרו", input.documents.join(", "), "ltr"],
    ["מועד האישור", stamp, "rtl"],
    ["כתובת IP", input.ip || "לא נרשמה", "ltr"],
    ["דפדפן", (input.userAgent || "לא נרשם").slice(0, 180), "ltr"],
  ];

  const html = layout(
    "תיעוד אישור תנאי שימוש",
    `<h1 dir="rtl" align="right" style="margin:0 0 8px;font-size:20px;direction:rtl;text-align:right">תיעוד אישור תנאי שימוש</h1>
     <p dir="rtl" align="right" style="margin:0 0 20px;color:#68758a;line-height:1.6;direction:rtl;text-align:right">${escapeHtml(input.customerName)} אישר/ה את המסמכים המשפטיים וחתם/ה עליהם דיגיטלית.</p>
     <table dir="rtl" style="width:100%;border-collapse:collapse;margin-bottom:16px;direction:rtl">
       ${rows
         .map(
           ([label, value, dir]) =>
             `<tr><td style="padding:8px 0;color:#8b96a8;font-size:13px;width:120px">${escapeHtml(label)}</td>` +
             (dir === "ltr"
               ? `<td style="padding:8px 0;font-weight:700;word-break:break-all" dir="ltr">${escapeHtml(value)}</td></tr>`
               : `<td dir="rtl" align="right" style="padding:8px 0;font-weight:700;text-align:right">${escapeHtml(value)}</td></tr>`),
         )
         .join("\n       ")}
     </table>
     <p dir="rtl" align="right" style="margin:0;color:#8b96a8;font-size:12px;line-height:1.6;direction:rtl;text-align:right">
       רשומה זו נשמרה גם בטבלת legal_acceptances ומהווה תיעוד קבוע. אין למחוק אותה.
     </p>`,
  );

  const text = [
    "תיעוד אישור תנאי שימוש",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "הרשומה נשמרה גם בטבלת legal_acceptances.",
  ].join("\n");

  return send({
    to: input.to,
    subject: `אישור תנאי שימוש — ${input.customerName} — ${input.contextLabel}`,
    html,
    text,
    replyTo: input.customerEmail,
  });
}
