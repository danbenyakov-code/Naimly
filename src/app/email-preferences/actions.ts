"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { applyPreferenceChanges } from "@/lib/email-preferences";
import type { NotificationPreferences } from "@/app/dashboard/settings/notifications/actions";

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * עדכון העדפות מתוך קישור במייל, בלי התחברות. הטוקן (256 ביט, ייחודי
 * למשתמש) הוא ההרשאה: הוא מאפשר לשנות רק את העדפות הדיוור של בעליו,
 * ושום דבר אחר בחשבון. נשמר באותה טבלה שמוצגת בהגדרות החשבון.
 */
export async function updatePreferencesByTokenAction(token: string, input: Partial<NotificationPreferences>): Promise<{ ok: boolean; error?: string }> {
  if (!TOKEN.test(token)) return { ok: false, error: "הקישור אינו תקין" };
  const limited = rateLimit(`email-prefs:${await clientIp()}`, 30, 600);
  if (!limited.ok) return { ok: false, error: "יותר מדי שינויים ברצף. אפשר לנסות שוב בעוד כמה דקות." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "השירות אינו זמין כרגע" };
  const { data } = await admin.from("email_preferences").select("user_id").eq("unsubscribe_token", token).maybeSingle();
  if (!data) return { ok: false, error: "הקישור אינו תקין או שפג תוקפו" };

  const result = await applyPreferenceChanges(admin, data.user_id as string, input, "email_link");
  return result.ok ? { ok: true } : { ok: false, error: "לא הצלחנו לשמור. אפשר לנסות שוב." };
}
