import type { ReactElement } from "react";
import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@/lib/config";
import { send, type EmailResult } from "@/lib/email";
import type { UnsubscribeLinks } from "@/emails/layout";

/**
 * שליחת מייל שאינו קריטי (תזכורות, דוחות, עדכונים).
 *
 * שלושה דברים שכל מייל כזה חייב, ולכן הם כאן ולא בכל קורא:
 *   1. בדיקת ההעדפה לפני שליחה. מי שביטל לא מקבל.
 *   2. קישורי הסרה בגוף המייל, וכותרות List-Unsubscribe להסרה בלחיצה
 *      אחת מתוך Gmail (RFC 8058).
 *   3. רישום ביומן הלקוח (email_sent), שעליו נשענת גם מניעת הכפילויות.
 *
 * מיילים קריטיים (קוד אימות, איפוס סיסמה, תשלום, פנייה חדשה) לא עוברים כאן.
 */

export type EmailCategory = "trial_reminders" | "weekly_report" | "product_updates" | "marketing";

export type EmailPreferences = {
  user_id: string;
  trial_reminders: boolean;
  weekly_report: boolean;
  product_updates: boolean;
  marketing: boolean;
  unsubscribe_token: string;
};

export function unsubscribeLinks(token: string): UnsubscribeLinks {
  return {
    unsubscribeUrl: `${brand.siteUrl}/unsubscribe/${token}`,
    // בחירה מתוך המייל, בלי התחברות. נשמר באותה טבלה שמוצגת בהגדרות החשבון.
    preferencesUrl: `${brand.siteUrl}/email-preferences/${token}`,
  };
}

/** כתובת ה-POST של Gmail. חייבת להיות HTTPS וללא הפניות. */
export function oneClickUnsubscribeUrl(token: string) {
  return `${brand.siteUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function loadPreferences(admin: SupabaseClient, userIds: string[]): Promise<Map<string, EmailPreferences>> {
  const map = new Map<string, EmailPreferences>();
  if (userIds.length === 0) return map;
  const { data } = await admin
    .from("email_preferences")
    .select("user_id,trial_reminders,weekly_report,product_updates,marketing,unsubscribe_token")
    .in("user_id", userIds);
  for (const row of (data || []) as EmailPreferences[]) map.set(row.user_id, row);
  return map;
}

export type NonCriticalResult = EmailResult | { sent: false; reason: "opted_out" | "no_preferences" };

export async function sendNonCriticalEmail(admin: SupabaseClient, input: {
  userId: string;
  to: string;
  category: EmailCategory;
  /** מזהה סוג המייל ביומן (למשל trial_ending_3d). משמש למניעת שליחה כפולה. */
  emailKey: string;
  subject: string;
  preferences: EmailPreferences | undefined;
  build: (links: UnsubscribeLinks) => ReactElement;
  /** נשמר ביומן לצד סוג המייל. */
  metadata?: Record<string, unknown>;
}): Promise<NonCriticalResult> {
  const preferences = input.preferences;
  // בלי שורת העדפות אין טוקן הסרה, ובלי טוקן אסור לשלוח מייל שיווקי.
  if (!preferences) return { sent: false, reason: "no_preferences" };
  if (!preferences[input.category]) return { sent: false, reason: "opted_out" };

  const element = input.build(unsubscribeLinks(preferences.unsubscribe_token));
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  const result = await send({
    to: input.to,
    subject: input.subject,
    html,
    text,
    replyTo: brand.supportEmail,
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(preferences.unsubscribe_token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (result.sent) {
    await admin.rpc("log_user_event", {
      target_user: input.userId,
      kind: "email_sent",
      details: { email: input.emailKey, category: input.category, via: result.via, ...input.metadata },
    });
  }
  return result;
}
