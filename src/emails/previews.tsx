import { render } from "@react-email/render";
import { brand } from "@/lib/config";
import { whatsappLink } from "@/lib/user-control";
import { LeadNotificationEmail } from "@/emails/lead-notification";
import { TrialEmail, trialEmailContent, type TrialEmailKind } from "@/emails/trial-email";
import { WeeklyReportEmail, WeeklyTipsEmail } from "@/emails/weekly-report";
import { leadCopy, weeklyCopy, type TrialEmailInput } from "@/emails/copy";

/**
 * דוגמאות לכל התבניות, לתצוגה מקדימה במסך /admin/emails ולמייל בדיקה.
 * הנתונים כאן מומצאים; במיילים האמיתיים הם נשלפים מהמסד.
 */

export const previewIds = [
  "trial_ending_3d", "trial_ending_3d_no_card", "trial_ending_1d", "trial_ending_1d_no_card",
  "trial_ended", "trial_ended_no_card", "weekly_report", "weekly_tips", "lead_notification",
] as const;
export type PreviewId = (typeof previewIds)[number];

export const previewTitles: Record<PreviewId, string> = {
  trial_ending_3d: "3 ימים לפני סוף הניסיון",
  trial_ending_3d_no_card: "3 ימים לפני, בלי כרטיס",
  trial_ending_1d: "יום לפני סוף הניסיון",
  trial_ending_1d_no_card: "יום לפני, בלי כרטיס",
  trial_ended: "ביום סיום הניסיון",
  trial_ended_no_card: "ביום הסיום, בלי כרטיס",
  weekly_report: "דוח שבועי",
  weekly_tips: "דוח שבועי בלי צפיות: טיפים",
  lead_notification: "התראה על פנייה חדשה (קריטי)",
};

const sampleLinks = { unsubscribeUrl: `${brand.siteUrl}/unsubscribe/preview`, preferencesUrl: `${brand.siteUrl}/dashboard/settings/notifications` };
const sampleStats = { views: 142, clicks: 37, leads: 6 };
const thisWeek = { views: 48, clicks: 15, leads: 2, whatsapp: 9, phone: 3, navigation: 2, contactSave: 1 };
const lastWeek = { views: 31, clicks: 12, leads: 2, whatsapp: 7, phone: 2, navigation: 3, contactSave: 0 };

function trial(kind: TrialEmailKind, hasCard: boolean) {
  const input: TrialEmailInput = { name: "דנה", businessName: "סטודיו דנה", daysLeft: kind === "trial_ending_3d" ? 3 : kind === "trial_ending_1d" ? 1 : 0, hasCard, stats: sampleStats };
  return {
    subject: trialEmailContent(kind, input).subject,
    element: <TrialEmail kind={kind} input={input} ctaUrl={`${brand.siteUrl}/pricing`} buildUrl={`${brand.siteUrl}/dashboard/card`} unsubscribe={sampleLinks} />,
  };
}

function build(id: PreviewId) {
  switch (id) {
    case "trial_ending_3d": return trial("trial_ending_3d", true);
    case "trial_ending_3d_no_card": return trial("trial_ending_3d", false);
    case "trial_ending_1d": return trial("trial_ending_1d", true);
    case "trial_ending_1d_no_card": return trial("trial_ending_1d", false);
    case "trial_ended": return trial("trial_ended", true);
    case "trial_ended_no_card": return trial("trial_ended", false);
    case "weekly_report":
      return { subject: weeklyCopy.report({ name: "דנה", thisWeek, lastWeek }).subject, element: <WeeklyReportEmail name="דנה" thisWeek={thisWeek} lastWeek={lastWeek} ctaUrl={`${brand.siteUrl}/dashboard/analytics`} unsubscribe={sampleLinks} /> };
    case "weekly_tips":
      return { subject: weeklyCopy.tips({ name: "דנה" }).subject, element: <WeeklyTipsEmail name="דנה" ctaUrl={`${brand.siteUrl}/dashboard/card`} unsubscribe={sampleLinks} /> };
    case "lead_notification": {
      const lead = { name: "יוסי לוי", phone: "050-1234567", email: "yossi@example.com", message: "היי, אשמח לשמוע פרטים על חבילת הצילום לאירוע ביוני." };
      return {
        subject: leadCopy.subject("סטודיו דנה"),
        element: <LeadNotificationEmail businessName="סטודיו דנה" lead={lead} whatsappUrl={whatsappLink(lead.phone, leadCopy.whatsappGreeting(lead.name, "סטודיו דנה"))} leadsUrl={`${brand.siteUrl}/dashboard/leads`} />,
      };
    }
  }
}

export async function renderPreview(id: PreviewId) {
  const { subject, element } = build(id);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, html, text };
}
