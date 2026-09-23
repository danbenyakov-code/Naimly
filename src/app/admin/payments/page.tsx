import type { Metadata } from "next";
import { getViewer } from "@/lib/data";
import { getAdminCustomers, getPaymentRequests } from "@/lib/admin-data";
import { PaymentsBoard } from "@/components/admin/payments-board";

export const metadata: Metadata = { title: "תשלומים ולקוחות", robots: { index: false, follow: false } };

export default async function AdminPaymentsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;

  const [requests, customers] = await Promise.all([getPaymentRequests(viewer), getAdminCustomers(viewer)]);

  return (
    <div className="mx-auto max-w-[1260px]">
      <div>
        <p className="text-sm font-bold text-[#6d4aff]">Admin</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">תשלומים ולקוחות</h1>
        <p className="mt-1 text-sm text-[#718096]">בדיקת בקשות רכישה, שליחת קישורי תשלום ואימות ידני, עד לחיבור עתידי לספק סליקה.</p>
      </div>
      <PaymentsBoard requests={requests} customers={customers} demo={viewer.demo} />
    </div>
  );
}
