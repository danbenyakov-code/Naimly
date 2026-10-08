import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "@/lib/legal";
import { clientIp } from "@/lib/rate-limit";

/**
 * עדכון העדפות דיוור בשרת, מכל מקור (הגדרות, קישור במייל, מסך הניסיון,
 * אישור התקנון).
 *
 * שני סוגים, שני כללים:
 *   - מיילי שירות (trial_reminders, weekly_report): עדכון רגיל.
 *   - דיוור שיווקי (product_updates, marketing): כיבוי רגיל, אבל הדלקה רק
 *     דרך record_marketing_consent, שרושמת ראיה (גרסה, זמן, IP, דפדפן).
 *     הלקוח אינו יכול להדליק שיווק ישירות במסד (מיגרציה 037).
 */

export type PreferenceKey = "trial_reminders" | "weekly_report" | "product_updates" | "marketing";
export type PreferenceChanges = Partial<Record<PreferenceKey, boolean>>;
export type ConsentSource = "trial" | "re_accept" | "settings" | "email_link";

const SERVICE_KEYS: PreferenceKey[] = ["trial_reminders", "weekly_report"];
const MARKETING_KEYS: PreferenceKey[] = ["product_updates", "marketing"];

export async function recordMarketingConsent(admin: SupabaseClient, userId: string, source: ConsentSource, categories: PreferenceKey[] = MARKETING_KEYS) {
  const wanted = categories.filter((key) => MARKETING_KEYS.includes(key));
  if (wanted.length === 0) return { ok: true as const };
  const { error } = await admin.rpc("record_marketing_consent", {
    target_user: userId,
    consent_source: source,
    categories: wanted,
    accepted_version: LEGAL_VERSION,
    client_ip: await clientIp(),
    client_agent: ((await headers()).get("user-agent") || "").slice(0, 400) || null,
  });
  if (error) console.error(`[email-preferences] consent ${error.code} ${error.message}`);
  return error ? { ok: false as const } : { ok: true as const };
}

export async function applyPreferenceChanges(admin: SupabaseClient, userId: string, input: PreferenceChanges, source: ConsentSource): Promise<{ ok: boolean }> {
  const plain: PreferenceChanges = {};
  const turnOnMarketing: PreferenceKey[] = [];
  for (const key of [...SERVICE_KEYS, ...MARKETING_KEYS]) {
    const value = input[key];
    if (typeof value !== "boolean") continue;
    if (MARKETING_KEYS.includes(key) && value) turnOnMarketing.push(key);
    else plain[key] = value;
  }

  if (Object.keys(plain).length > 0) {
    const { error } = await admin.from("email_preferences").update(plain).eq("user_id", userId);
    if (error) return { ok: false };
  }
  if (turnOnMarketing.length > 0) {
    const result = await recordMarketingConsent(admin, userId, source, turnOnMarketing);
    if (!result.ok) return { ok: false };
  }
  return { ok: true };
}
