import { NextResponse } from "next/server";
import { z } from "zod";
import { plans } from "@/lib/config";
import { auditLog, isResponse, requireAdmin } from "@/lib/admin-guard";
import { clampCardToPlan } from "@/lib/plan-access";
import { normalizeCard } from "@/lib/data";
import { cardToDatabaseRow } from "@/lib/card-row";
import { sendPlanActivatedNotification } from "@/lib/email";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  months: z.number().int().min(1).max(24).optional(),
  adminNote: z.string().max(500).optional(),
});

/**
 * אישור או דחייה של בקשת תשלום בביט.
 * באישור: המנוי מופעל, והכרטיס הקיים נגזם למגבלות המסלול שנרכש — כך שהלקוח
 * שהתנסה ביכולות של פרימיום לא יישאר עם כרטיס שנחסם בשמירה הבאה.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;
  const { admin, viewer } = context;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "מזהה בקשה אינו תקין" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const { data: paymentRequest } = await admin
    .from("payment_requests")
    .select("id,user_id,plan_id,amount,status,reference,profiles(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  if (!paymentRequest) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });
  if (paymentRequest.status !== "pending") {
    return NextResponse.json({ error: "הבקשה כבר טופלה" }, { status: 409 });
  }

  if (parsed.data.action === "reject") {
    const { error } = await admin
      .from("payment_requests")
      .update({ status: "rejected", admin_note: parsed.data.adminNote || "", reviewed_by: viewer.id, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: "לא הצלחנו לעדכן את הבקשה" }, { status: 500 });
    await auditLog(context, "payment_request.reject", "payment_request", id, { reference: paymentRequest.reference });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const plan = plans.find((item) => item.id === paymentRequest.plan_id);
  if (!plan) return NextResponse.json({ error: "המסלול בבקשה אינו מוכר" }, { status: 400 });
  const months = parsed.data.months || 1;

  const { error: activateError } = await admin.rpc("activate_subscription", {
    target_user: paymentRequest.user_id,
    target_plan: paymentRequest.plan_id,
    months,
    actor: viewer.id,
  });
  if (activateError) return NextResponse.json({ error: "הפעלת המנוי נכשלה" }, { status: 500 });

  // גיזום הכרטיס למגבלות המסלול שנרכש.
  const { data: cardRow } = await admin.from("cards").select("*").eq("user_id", paymentRequest.user_id).maybeSingle();
  let trimmed: string[] = [];
  if (cardRow) {
    const card = normalizeCard(cardRow);
    const clamped = clampCardToPlan(card, plan.id);
    if (JSON.stringify(clamped) !== JSON.stringify(card)) {
      trimmed = [
        card.gallery.length !== clamped.gallery.length ? `גלריה: ${card.gallery.length} → ${clamped.gallery.length}` : "",
        card.quickActions.length !== clamped.quickActions.length ? `פעולות: ${card.quickActions.length} → ${clamped.quickActions.length}` : "",
        card.files.length !== clamped.files.length ? `קבצים: ${card.files.length} → ${clamped.files.length}` : "",
      ].filter(Boolean);
      await admin.from("cards").update(cardToDatabaseRow(clamped, paymentRequest.user_id)).eq("id", card.id);
    }
  }

  const { error } = await admin
    .from("payment_requests")
    .update({ status: "approved", admin_note: parsed.data.adminNote || "", reviewed_by: viewer.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return NextResponse.json({ error: "המנוי הופעל אך עדכון הבקשה נכשל" }, { status: 500 });

  await auditLog(context, "payment_request.approve", "payment_request", id, { reference: paymentRequest.reference, plan: plan.id, months, trimmed });

  // אישור ללקוח. כישלון בשליחה אינו מבטל את ההפעלה שכבר בוצעה.
  const customer = (paymentRequest as unknown as { profiles?: { full_name?: string; email?: string } }).profiles;
  if (customer?.email) {
    await sendPlanActivatedNotification({
      to: customer.email,
      customerName: customer.full_name || "לקוח יקר",
      planName: plan.name,
      months,
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, status: "approved", plan: plan.id, months, trimmed });
}
