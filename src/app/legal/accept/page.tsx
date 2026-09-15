import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { LEGAL_VERSION, requiresLegalReAcceptance } from "@/lib/legal";
import { AcceptTermsForm } from "@/components/legal/accept-terms-form";

export const metadata: Metadata = {
  title: "אישור תנאי שימוש מעודכנים",
  robots: { index: false, follow: false },
};

/**
 * שער האישור מחדש.
 *
 * מי שכבר אישר את הגרסה הנוכחית אינו רואה את הדף — אחרת כל כניסה
 * הייתה מבקשת אישור חוזר ומייצרת רשומות כפולות שמטשטשות את הראיה.
 */
export default async function AcceptLegalPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי לאשר את המסמכים"));

  const params = await searchParams;
  if (viewer.demo || !requiresLegalReAcceptance(viewer.termsVersion)) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.14),transparent_45%),#f6f7fb] px-4 py-10 sm:py-16">
      <AcceptTermsForm
        fullName={viewer.fullName}
        previousVersion={viewer.termsVersion}
        currentVersion={LEGAL_VERSION}
        next={params.next || ""}
      />
    </main>
  );
}
