import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NotificationPreferences } from "@/app/dashboard/settings/notifications/actions";

export const metadata: Metadata = { title: "העדפות דיוור", robots: { index: false, follow: false } };

/**
 * בחירת סוגי המיילים מתוך קישור במייל, בלי התחברות. הטעינה רק קוראת:
 * שום דבר לא משתנה עד שהלקוח לוחץ על מתג.
 */
export default async function EmailPreferencesByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preferences: (NotificationPreferences & { email: string }) | null = null;

  if (/^[0-9a-f]{64}$/.test(token)) {
    const admin = createSupabaseAdminClient();
    const { data } = admin
      ? await admin.from("email_preferences").select("trial_reminders,weekly_report,product_updates,marketing,profiles(email)").eq("unsubscribe_token", token).maybeSingle()
      : { data: null };
    if (data) {
      const profile = data.profiles as unknown as { email?: string } | null;
      preferences = { trial_reminders: data.trial_reminders, weekly_report: data.weekly_report, product_updates: data.product_updates, marketing: data.marketing, email: profile?.email || "" };
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.12),transparent_45%),#f6f7fb] px-4 py-10">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center text-2xl font-black tracking-[-0.04em] sm:text-3xl">אילו מיילים לשלוח לך?</h1>
        {preferences ? (
          <>
            <p className="mt-2 text-center text-sm text-[#68758a]">
              ההעדפות של <span dir="ltr" className="font-bold">{preferences.email}</span>. כל שינוי נשמר מיד, גם בהגדרות החשבון שלך.
            </p>
            <NotificationPreferencesForm initial={preferences} token={token} />
          </>
        ) : (
          <p className="card-surface mt-6 p-6 text-center text-[#4a5871]">
            הקישור אינו תקין או שפג תוקפו. אפשר לנהל את ההעדפות גם מתוך החשבון, במסך הגדרות ← העדפות דיוור.
          </p>
        )}
      </div>
    </main>
  );
}
