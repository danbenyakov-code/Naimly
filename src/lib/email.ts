import nodemailer, { type Transporter } from "nodemailer";
import { brand } from "@/lib/config";

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

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0b1020">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#0b1020;border-radius:18px 18px 0 0;padding:20px 24px">
      <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">${escapeHtml(brand.name)}</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 18px 18px;padding:24px">
      ${bodyHtml}
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#8b96a8">
      ${escapeHtml(brand.name)} · <a href="${brand.siteUrl}" style="color:#6d4aff">${escapeHtml(brand.siteUrl)}</a>
    </p>
  </div>
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
    `<h1 style="margin:0 0 8px;font-size:20px">פנייה חדשה 🎉</h1>
     <p style="margin:0 0 20px;color:#68758a;line-height:1.6">התקבלה פנייה חדשה מהכרטיס של ${escapeHtml(input.businessName)}.</p>
     <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
       ${rows.map(([label, value]) => `<tr>
         <td style="padding:8px 0;color:#8b96a8;font-size:13px;width:80px">${escapeHtml(label)}</td>
         <td style="padding:8px 0;font-weight:700">${escapeHtml(value)}</td>
       </tr>`).join("")}
     </table>
     ${lead.message ? `<div style="background:#f6f7fb;border-radius:12px;padding:14px;line-height:1.7">${escapeHtml(lead.message)}</div>` : ""}
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
}): Promise<EmailResult> {
  const html = layout(
    "בקשת תשלום חדשה",
    `<h1 style="margin:0 0 8px;font-size:20px">בקשת תשלום חדשה</h1>
     <p style="margin:0 0 20px;color:#68758a;line-height:1.6">${escapeHtml(input.customerName)} ביקש להפעיל מסלול ${escapeHtml(input.planName)}.</p>
     <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px;width:90px">לקוח</td><td style="padding:8px 0;font-weight:700">${escapeHtml(input.customerName)}</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">אימייל</td><td style="padding:8px 0;font-weight:700" dir="ltr">${escapeHtml(input.customerEmail)}</td></tr>
       <tr><td style="padding:8px 0;color:#8b96a8;font-size:13px">מסלול</td><td style="padding:8px 0;font-weight:700">${escapeHtml(input.planName)} — ${input.amount} ש״ח</td></tr>
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
    `<h1 style="margin:0 0 8px;font-size:20px">המסלול שלך פעיל 🎉</h1>
     <p style="margin:0 0 16px;color:#68758a;line-height:1.6">
       היי ${escapeHtml(input.customerName)}, אישרנו את התשלום והמסלול
       <strong>${escapeHtml(input.planName)}</strong> פעיל למשך ${input.months} חודשים.
     </p>
     <p style="margin:0 0 20px;color:#68758a;line-height:1.6">הכרטיס שלך חזר לאוויר וכל היכולות של המסלול פתוחות.</p>
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
    `<h1 style="margin:0 0 8px;font-size:20px">קיבלנו את הפנייה שלך</h1>
     <p style="margin:0 0 16px;color:#68758a;line-height:1.6">
       היי ${escapeHtml(input.name)}, הפנייה בנושא <strong>${escapeHtml(input.topicLabel)}</strong> התקבלה.
       נחזור אליך בדרך כלל תוך יום עסקים אחד.
     </p>`,
  );

  const text = `היי ${input.name},\n\nקיבלנו את הפנייה בנושא ${input.topicLabel}. נחזור אליך תוך יום עסקים.\n\n${brand.name}`;

  return send({ to: input.to, subject: `קיבלנו את הפנייה שלך — ${input.topicLabel}`, html, text });
}
