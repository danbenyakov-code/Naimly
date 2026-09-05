import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { getAdminCustomers, getPaymentRequests } from "@/lib/admin-data";
import { ApprovalsBoard } from "@/components/admin/approvals-board";

export const metadata: Metadata = { title: "אישורים ולקוחות", robots: { index: false, follow: false } };

export default async function ApprovalsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;

  const [requests, customers] = await Promise.all([getPaymentRequests(viewer), getAdminCustomers(viewer)]);

  return (
    <div className="mx-auto max-w-[1260px]">
      <div>
        <p className="text-sm font-bold text-[#6d4aff]">Admin</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">אישורי תשלום ולקוחות</h1>
        <p className="mt-1 text-sm text-[#718096]">אישור העברות בביט, פתיחת חשבונות ושליחת פרטי כניסה בוואטסאפ.</p>
      </div>
      <ApprovalsBoard requests={requests} customers={customers} demo={viewer.demo} />
    </div>
  );
}
