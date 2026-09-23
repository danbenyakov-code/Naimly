import { NextResponse } from "next/server";
import { z } from "zod";
import { isExtraCard, plans } from "@/lib/config";
import { auditLog, isResponse, requireAdmin } from "@/lib/admin-guard";
import { clampCardToPlan } from "@/lib/plan-access";
import { normalizeCard } from "@/lib/data";
import { cardToDatabaseRow } from "@/lib/card-row";
import { sendPaymentLinkNotification, sendPlanActivatedNotification } from "@/lib/email";
import { orderWhatsappPaymentLink } from "@/lib/payments";
import { canTransition, isPurchaseStatus, paymentLinkExpiry, type PurchaseStatus } from "@/lib/purchase-workflow";

const schema = z.object({
  action: z.enum([
    "approve_in_principle",
    "send_payment_link",
    "resend_payment_link",
    "verify_payment",
    "activate",
    "reject",
    "cancel",
    "mark_invoice_issued",
  ]),
  adminNote: z.string().max(500).optional(),
  paymentReference: z.string().max(120).optional(),
  invoiceReference: z.string().max(120).optional(),
  invoiceNote: z.string().max(500).optional(),
});

type RequestRow = {
  id: string; user_id: string; plan_id: string; billing_cycle: string | null; amount: number;
  status: string; reference: string; plan_name_snapshot: string | null; card_id: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

/**
 * כל פעולה על בקשת רכישה — לא רק אישור/דחייה כפי שהיה קודם.
 *
 * המעברים נבדקים גם כאן (canTransition, לפני קריאה למסד) וגם ב-trigger
 * בפוסטגרס (migration 029). שכבה ראשונה נותנת שגיאה ברורה; השנייה היא
 * ההגנה האמיתית שאי אפשר לעקוף אותה מ-RPC אחר או מסביבה עתידית.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;
  const { admin, viewer } = context;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "מזהה בקשה אינו תקין" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const { action } = parsed.data;

  const { data: row } = await admin
    .from("payment_requests")
    .select("id,user_id,plan_id,billing_cycle,amount,status,reference,plan_name_snapshot,card_id,profiles(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  const paymentRequest = row as unknown as RequestRow | null;
  if (!paymentRequest) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });
  const currentStatus = isPurchaseStatus(paymentRequest.status) ? paymentRequest.status : "pending_admin_review";
  const customer = paymentRequest.profiles;
  const planName = paymentRequest.plan_name_snapshot || paymentRequest.plan_id;

  const guardTransition = (to: PurchaseStatus) => {
    if (!canTransition(currentStatus, to)) {
      return NextResponse.json({ error: `אי אפשר לעבור מ"${currentStatus}" ל"${to}" — הבקשה כבר טופלה או שהמעבר לא חוקי` }, { status: 409 });
    }
    return null;
  };

  if (action === "approve_in_principle") {
    const blocked = guardTransition("awaiting_payment_link");
    if (blocked) return blocked;
    const { error } = await admin.from("payment_requests").update({ status: "awaiting_payment_link", reviewed_by: viewer.id, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message.startsWith("STATUS_TRANSITION:") ? error.message.slice(18) : "לא הצלחנו לעדכן את הבקשה" }, { status: 400 });
    await auditLog(context, "payment_request.approve_in_principle", "payment_request", id, { reference: paymentRequest.reference });
    return NextResponse.json({ ok: true, status: "awaiting_payment_link" });
  }

  if (action === "send_payment_link" || action === "resend_payment_link") {
    const targetStatus: PurchaseStatus = "payment_link_sent";
    if (action === "send_payment_link") {
      const blocked = guardTransition(targetStatus);
      if (blocked) return blocked;
    } else if (currentStatus !== "payment_link_sent") {
      return NextResponse.json({ error: "אפשר לשלוח קישור מחדש רק כשקישור כבר נשלח בעבר" }, { status: 409 });
    }
    if (!customer?.email) return NextResponse.json({ error: "ללקוח אין כתובת אימייל רשומה" }, { status: 400 });

    const link = orderWhatsappPaymentLink({
      planName,
      amount: paymentRequest.amount,
      cycle: paymentRequest.billing_cycle === "annual" ? "annual" : "monthly",
      reference: paymentRequest.reference,
      customerName: customer?.full_name || "לקוח",
    });
    const expiresAt = paymentLinkExpiry();
    const nowIso = new Date().toISOString();

    const { error } = await admin.from("payment_requests").update({
      status: targetStatus,
      payment_link: link,
      payment_link_expires_at: expiresAt,
      payment_link_sent_at: nowIso,
      reviewed_by: viewer.id,
      updated_at: nowIso,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message.startsWith("STATUS_TRANSITION:") ? error.message.slice(18) : "לא הצלחנו לעדכן את הבקשה" }, { status: 400 });

    await sendPaymentLinkNotification({
      to: customer.email,
      customerName: customer.full_name || "לקוח יקר",
      planName,
      amount: paymentRequest.amount,
      cycle: paymentRequest.billing_cycle === "annual" ? "annual" : "monthly",
      reference: paymentRequest.reference,
      paymentLink: link,
      expiresAt,
    }).catch(() => null);

    await auditLog(context, `payment_request.${action}`, "payment_request", id, { reference: paymentRequest.reference });
    return NextResponse.json({ ok: true, status: targetStatus });
  }

  if (action === "verify_payment") {
    if (!["customer_reported_paid", "payment_verification"].includes(currentStatus)) {
      return NextResponse.json({ error: "אפשר לאמת תשלום רק אחרי שהלקוח דיווח על תשלום" }, { status: 409 });
    }
    const { error } = await admin.rpc("verify_purchase_payment", {
      request_id: id,
      actor: viewer.id,
      confirmed_reference: parsed.data.paymentReference || null,
      admin_note_text: parsed.data.adminNote || null,
    });
    if (error) return NextResponse.json({ error: "אימות התשלום נכשל" }, { status: 500 });
    await auditLog(context, "payment_request.verify_payment", "payment_request", id, { reference: paymentRequest.reference, paymentReference: parsed.data.paymentReference });
    return NextResponse.json({ ok: true, status: "paid_pending_activation" });
  }

  if (action === "activate") {
    if (currentStatus !== "paid_pending_activation" && currentStatus !== "active") {
      return NextResponse.json({ error: "אפשר להפעיל רק בקשה שהתשלום שלה אומת (ממתינה להפעלה)" }, { status: 409 });
    }

    const { data: activation, error: activateError } = await admin
      .rpc("activate_purchase_request", { request_id: id, actor: viewer.id })
      .single();
    if (activateError) return NextResponse.json({ error: activateError.message.startsWith("STATUS_TRANSITION:") ? activateError.message.slice(18) : "הפעלת המנוי נכשלה" }, { status: 400 });

    const result = activation as { already_active: boolean; plan_id: string; months: number };
    if (result.already_active) return NextResponse.json({ ok: true, status: "active", alreadyActive: true });

    // גיזום הכרטיס למגבלות המסלול שנרכש (לא רלוונטי ל"כרטיס נוסף").
    const trimmed: string[] = [];
    if (!isExtraCard(paymentRequest.plan_id)) {
      const plan = plans.find((item) => item.id === paymentRequest.plan_id);
      const { data: cardRow } = await admin.from("cards").select("*").eq("user_id", paymentRequest.user_id).maybeSingle();
      if (plan && cardRow) {
        const card = normalizeCard(cardRow);
        const clamped = clampCardToPlan(card, plan.id);
        if (JSON.stringify(clamped) !== JSON.stringify(card)) {
          if (card.gallery.length !== clamped.gallery.length) trimmed.push(`גלריה: ${card.gallery.length} → ${clamped.gallery.length}`);
          if (card.quickActions.length !== clamped.quickActions.length) trimmed.push(`פעולות: ${card.quickActions.length} → ${clamped.quickActions.length}`);
          if (card.files.length !== clamped.files.length) trimmed.push(`קבצים: ${card.files.length} → ${clamped.files.length}`);
          await admin.from("cards").update(cardToDatabaseRow(clamped, paymentRequest.user_id)).eq("id", card.id);
        }
      }
    }

    await auditLog(context, "payment_request.activate", "payment_request", id, { reference: paymentRequest.reference, plan: result.plan_id, months: result.months, trimmed });

    if (customer?.email) {
      await sendPlanActivatedNotification({
        to: customer.email,
        customerName: customer.full_name || "לקוח יקר",
        planName,
        months: result.months || 1,
        reference: paymentRequest.reference,
        activatedAt: new Date().toISOString(),
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, status: "active", plan: result.plan_id, months: result.months, trimmed });
  }

  if (action === "reject" || action === "cancel") {
    const targetStatus: PurchaseStatus = action === "reject" ? "rejected" : "cancelled";
    const blocked = guardTransition(targetStatus);
    if (blocked) return blocked;
    const timestampField = action === "reject" ? "rejected_at" : "cancelled_at";
    const { error } = await admin.from("payment_requests").update({
      status: targetStatus,
      admin_note: parsed.data.adminNote || "",
      reviewed_by: viewer.id,
      reviewed_at: new Date().toISOString(),
      [timestampField]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message.startsWith("STATUS_TRANSITION:") ? error.message.slice(18) : "לא הצלחנו לעדכן את הבקשה" }, { status: 400 });
    await auditLog(context, `payment_request.${action}`, "payment_request", id, { reference: paymentRequest.reference, note: parsed.data.adminNote });
    return NextResponse.json({ ok: true, status: targetStatus });
  }

  if (action === "mark_invoice_issued") {
    const { error } = await admin.from("payment_requests").update({
      invoice_issued: true,
      invoice_reference: parsed.data.invoiceReference || null,
      invoice_issued_at: new Date().toISOString(),
      invoice_note: parsed.data.invoiceNote || "",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return NextResponse.json({ error: "לא הצלחנו לסמן שהופקה חשבונית" }, { status: 500 });
    await auditLog(context, "payment_request.mark_invoice_issued", "payment_request", id, { reference: paymentRequest.reference, invoiceReference: parsed.data.invoiceReference });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
}
