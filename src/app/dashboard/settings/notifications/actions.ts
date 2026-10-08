"use server";

import { getViewer } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyPreferenceChanges } from "@/lib/email-preferences";

export type NotificationPreferences = {
  trial_reminders: boolean;
  weekly_report: boolean;
  product_updates: boolean;
  marketing: boolean;
};

/**
 * עדכון העדפות הדיוור של המשתמש המחובר. מזהה המשתמש נלקח מה-session
 * בשרת ולא מהלקוח, ולכן אפשר לגעת רק בשורה של עצמו. הדלקת דיוור שיווקי
 * נרשמת כהסכמה (ראו applyPreferenceChanges).
 */
export async function updateNotificationPreferencesAction(input: Partial<NotificationPreferences>): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "יש להתחבר מחדש" };
  if (viewer.demo) return { ok: true };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "שירות הנתונים אינו זמין" };
  const result = await applyPreferenceChanges(admin, viewer.id, input, "settings");
  return result.ok ? { ok: true } : { ok: false, error: "לא הצלחנו לשמור. אפשר לנסות שוב." };
}
