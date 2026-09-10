import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanChoice } from "@/components/onboarding/plan-choice";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "בחירת מסלול",
  robots: { index: false, follow: false },
};

/**
 * שער ההצטרפות. מי שכבר בחר לא רואה אותו — הפניה חזרה לדשבורד מונעת
 * מצב שבו לקוח קיים "בוחר" שוב ומאפס בטעות את הספירה.
 */
export default async function OnboardingPlanPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי לבחור מסלול"));
  if (viewer.planSelectedAt || viewer.demo) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.14),transparent_45%),#f6f7fb]">
      <PlanChoice fullName={viewer.fullName} />
    </main>
  );
}
