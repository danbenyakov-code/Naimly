import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = { title: "ניהול המערכת", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") redirect("/dashboard");
  return <DashboardShell viewer={viewer}>{children}</DashboardShell>;
}
