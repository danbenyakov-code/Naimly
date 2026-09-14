import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCardStatus, getViewer } from "@/lib/data";
import { requiresLegalReAcceptance } from "@/lib/legal";

export const metadata: Metadata = { title: "אזור אישי", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי להמשיך"));

  /*
   * שער ההצטרפות. משתמש שנרשם ישירות ב-/signup, בלי לעבור דרך עמוד
   * התמחור, הגיע עד היום לדשבורד בלי מסלול כלל: הטיימר על אפס והלקוח
   * לא יודע מה קיבל. בלי בחירה מפורשת אין כניסה.
   */
  if (!viewer.demo && !viewer.planSelectedAt) redirect("/onboarding/plan");

  /*
   * שער האישור המחודש. הסכמה לנוסח קודם אינה הסכמה לנוסח הנוכחי, ולכן
   * אין התקדמות במערכת עד לאישור הגרסה בתוקף. באנר שאפשר לסגור לא היה
   * שווה דבר — הוא משאיר את השימוש נמשך תחת נוסח שלא אושר.
   */
  if (!viewer.demo && requiresLegalReAcceptance(viewer.termsVersion)) redirect("/legal/accept");

  const cardStatus = await getCardStatus(viewer);
  return <DashboardShell viewer={viewer} cardStatus={cardStatus}>{children}</DashboardShell>;
}
