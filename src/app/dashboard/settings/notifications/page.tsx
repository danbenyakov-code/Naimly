import type { Metadata } from "next";
import { BackButton } from "@/components/ui/back-button";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationPreferences } from "./actions";

export const metadata: Metadata = { title: "העדפות דיוור", robots: { index: false, follow: false } };

const defaults: NotificationPreferences = { trial_reminders: true, weekly_report: true, product_updates: true, marketing: true };

export default async function NotificationsSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  let preferences = defaults;
  if (!viewer.demo) {
    const supabase = await createSupabaseServerClient();
    const { data } = supabase
      ? await supabase.from("email_preferences").select("trial_reminders,weekly_report,product_updates,marketing").eq("user_id", viewer.id).maybeSingle()
      : { data: null };
    if (data) preferences = data as NotificationPreferences;
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <BackButton fallback="/dashboard/settings" ariaLabel="חזרה להגדרות" className="mb-3" />
      <p className="text-sm font-bold text-[#6d4aff]">חשבון</p>
      <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">העדפות דיוור</h1>
      <p className="mt-1 text-sm text-[#718096]">בוחרים אילו מיילים לקבל מאיתנו. אפשר לשנות בכל רגע.</p>
      <NotificationPreferencesForm initial={preferences} />
    </div>
  );
}
