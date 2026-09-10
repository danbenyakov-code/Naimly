import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getViewer } from "@/lib/data";

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

  return <DashboardShell viewer={viewer}>{children}</DashboardShell>;
}
