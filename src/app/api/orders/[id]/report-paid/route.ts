import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { canTransition, isPurchaseStatus } from "@/lib/purchase-workflow";
import { sendCustomerReportedPaidNotification } from "@/lib/email";
import { adminNotificationEmail } from "@/lib/config";

const schema = z.object({
  paymentReference: z.string().max(120).optional(),
  customerNotes: z.string().max(500).optional(),
});

/**
 * "שילמתי — שליחה לבדיקה", מסך "ההזמנה שלי" של הלקוח.
 *
 * זו הפעולה היחידה שלקוח רגיל יכול לבצע על בקשת הרכישה שלו, ורק על
 * הבקשה שלו עצמו — לא ניתן לעדכן סטטוס בשום דרך אחרת מכאן, ובוודאי
 * לא להפעיל מנוי. מסמנת רק "הלקוח אומר ששילם"; אימות והפעלה בפועל
 * נשארים אצל האדמין בלבד (verify_purchase_payment / activate_purchase_request).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  if (viewer.demo) return NextResponse.json({ error: "לא זמין במצב הדגמה" }, { status: 400 });

  const limited = rateLimit(`report-paid:${viewer.id}`, 10, 600);
  if (!limited.ok) return tooManyRequests(limited, "יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "מזהה הזמנה אינו תקין" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  const { data: order } = await admin
    .from("payment_requests")
    .select("id,user_id,status,reference,plan_name_snapshot,amount")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "ההזמנה לא נמצאה" }, { status: 404 });

  // בעלות: לקוח יכול לדווח רק על ההזמנה שלו עצמו — נבדק בשרת, לא רק מוסתר בממשק.
  if (order.user_id !== viewer.id) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const currentStatus = isPurchaseStatus(order.status) ? order.status : "pending_admin_review";
  // "המשתמש מדווח ששילם לפני שנשלח קישור" — נחסם כאן במפורש.
  if (!canTransition(currentStatus, "customer_reported_paid")) {
    return NextResponse.json({ error: "אפשר לדווח על תשלום רק אחרי שקישור תשלום נשלח" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin.from("payment_requests").update({
    status: "customer_reported_paid",
    customer_reported_paid_at: nowIso,
    payment_reference: parsed.data.paymentReference || null,
    customer_notes: parsed.data.customerNotes || "",
    updated_at: nowIso,
  }).eq("id", id).eq("status", currentStatus);
  if (error) return NextResponse.json({ error: error.message.startsWith("STATUS_TRANSITION:") ? "ההזמנה כבר עודכנה בינתיים" : "לא הצלחנו לעדכן את ההזמנה" }, { status: 400 });

  await admin.from("admin_audit_log").insert({
    actor_id: viewer.id,
    action: "payment_request.customer_reported_paid",
    entity_type: "payment_request",
    entity_id: id,
    details: { reference: order.reference },
  });

  await sendCustomerReportedPaidNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    planName: order.plan_name_snapshot || "",
    amount: order.amount,
    reference: order.reference,
    reportedAt: nowIso,
    paymentReference: parsed.data.paymentReference,
  }).catch(() => null);

  return NextResponse.json({ ok: true, status: "customer_reported_paid" });
}
