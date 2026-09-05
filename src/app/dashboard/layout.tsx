import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = { title: "אזור אישי", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי להמשיך"));
  return <DashboardShell viewer={viewer}>{children}</DashboardShell>;
}
