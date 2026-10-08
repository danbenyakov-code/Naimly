"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { NotificationPreferences } from "@/app/dashboard/settings/notifications/actions";

const TOKEN = /^[0-9a-f]{64}$/;
const KEYS: Array<keyof NotificationPreferences> = ["trial_reminders", "weekly_report", "product_updates", "marketing"];

/**
 * עדכון העדפות מתוך קישור במייל, בלי התחברות. הטוקן (256 ביט, ייחודי
 * למשתמש) הוא ההרשאה: הוא מאפשר לשנות רק את העדפות הדיוור של בעליו,
 * ושום דבר אחר בחשבון. נשמר באותה טבלה שמוצגת בהגדרות החשבון.
 */
export async function updatePreferencesByTokenAction(token: string, input: Partial<NotificationPreferences>): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN.test(token)) return { ok: false, error: "הקישור אינו תקין" };
  const limited = rateLimit(`email-prefs:${await clientIp()}`, 30, 600);
  if (!limited.ok) return { ok: false, error: "יותר מדי שינויים ברצף. אפשר לנסות שוב בעוד כמה דקות." };

  const changes: Partial<NotificationPreferences> = {};
  for (const key of KEYS) if (typeof input[key] === "boolean") changes[key] = input[key];
  if (Object.keys(changes).length === 0) return { ok: true };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "השירות אינו זמין כרגע" };
  const { data, error } = await admin.from("email_preferences").update(changes).eq("unsubscribe_token", token).select("user_id");
  if (error) return { ok: false, error: "לא הצלחנו לשמור. אפשר לנסות שוב." };
  if (!data || data.length === 0) return { ok: false, error: "הקישור אינו תקין או שפג תוקפו" };
  return { ok: true };
}
