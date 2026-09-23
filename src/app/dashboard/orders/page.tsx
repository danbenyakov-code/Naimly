import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { getViewer } from "@/lib/data";
import { getMyPaymentRequests } from "@/lib/admin-data";
import { OrderStatusCard } from "@/components/dashboard/order-status-card";

export const metadata: Metadata = { title: "ההזמנות שלי", robots: { index: false, follow: false } };

export default async function OrdersPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const orders = viewer.demo ? [] : await getMyPaymentRequests(viewer);

  return (
    <div className="mx-auto max-w-[900px]">
      <div>
        <p className="text-sm font-bold text-[#6d4aff]">האזור האישי</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">ההזמנות שלי</h1>
        <p className="mt-1 text-sm text-[#718096]">מעקב אחר סטטוס בקשות הרכישה — מרגע הפתיחה ועד הפעלת החבילה.</p>
      </div>

      <div className="mt-6 grid gap-4">
        {orders.length === 0 && (
          <div className="card-surface grid min-h-40 place-items-center p-6 text-center">
            <div>
              <Receipt size={28} className="mx-auto text-[#a1aaba]" />
              <p className="mt-2 text-sm text-[#718096]">אין הזמנות עדיין.</p>
            </div>
          </div>
        )}
        {orders.map((order) => <OrderStatusCard key={order.id} order={order} />)}
      </div>
    </div>
  );
}
