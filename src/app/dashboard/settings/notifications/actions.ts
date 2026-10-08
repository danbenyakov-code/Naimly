"use server";

import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationPreferences = {
  trial_reminders: boolean;
  weekly_report: boolean;
  product_updates: boolean;
  marketing: boolean;
};

const KEYS: Array<keyof NotificationPreferences> = ["trial_reminders", "weekly_report", "product_updates", "marketing"];

/**
 * עדכון העדפות הדיוור של המשתמש המחובר. עובר דרך ה-session שלו, כך שה-RLS
 * (מיגרציה 035) מבטיח שאפשר לגעת רק בשורה של עצמו.
 */
export async function updateNotificationPreferencesAction(input: Partial<NotificationPreferences>): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "יש להתחבר מחדש" };
  if (viewer.demo) return { ok: true };

  const changes: Partial<NotificationPreferences> = {};
  for (const key of KEYS) if (typeof input[key] === "boolean") changes[key] = input[key];
  if (Object.keys(changes).length === 0) return { ok: true };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "שירות הנתונים אינו זמין" };
  const { error } = await supabase.from("email_preferences").update(changes).eq("user_id", viewer.id);
  if (error) return { ok: false, error: "לא הצלחנו לשמור. אפשר לנסות שוב." };
  return { ok: true };
}
