import { NextResponse } from "next/server";
import { z } from "zod";
import { extraCardProduct, isExtraCard, plans, toBillingCycle } from "@/lib/config";
import { getViewer } from "@/lib/data";
import { buildReference } from "@/lib/payments";
import { buildPriceSnapshot } from "@/lib/purchase-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bindingDocumentIds, LEGAL_VERSION } from "@/lib/legal";
import { adminNotificationEmail } from "@/lib/config";
import { sendLegalAcceptanceNotification, sendPaymentRequestNotification, sendPurchaseRequestReceived } from "@/lib/email";

const schema = z.object({
  planId: z.enum(["basic", "pro", "premium", "extra_card"]),
  cycle: z.enum(["monthly", "annual"]).optional(),
  phone: z.string().max(30).optional(),
  note: z.string().max(500).optional(),
});

/**
 * פותח בקשת רכישה. **אינה** פותחת תשלום ואינה מציגה הוראות תשלום ללקוח.
 *
 * הבקשה נוצרת במצב pending_admin_review — ממתינה לבדיקת מנהל. רק
 * לאחר שמנהל בודק ושולח קישור תשלום במפורש (מסך /admin/payments) הלקוח
 * מקבל את פרטי התשלום. ראו docs/qa — "תהליך רכישה ותשלומים ידניים".
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "יש להתחבר לפני הרכישה" }, { status: 401 });

  const limited = rateLimit(`payreq:${viewer.id}`, 10, 600);
  if (!limited.ok) return tooManyRequests(limited, "נפתחו יותר מדי בקשות רכישה ברצף. נסו שוב בעוד מספר דקות.");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "המסלול אינו תקין" }, { status: 400 });

  /*
   * "כרטיס נוסף" אינו מסלול, ולכן אינו ב-plans. הוא מקבל צורה תואמת
   * כדי לעבור באותו צינור — בקשה, אסמכתא, אישור מנהל.
   */
  const extra = isExtraCard(parsed.data.planId);
  const plan = extra
    ? { id: extraCardProduct.id, name: extraCardProduct.name, price: extraCardProduct.price } as unknown as (typeof plans)[number]
    : plans.find((item) => item.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 404 });

  /*
   * הסכום וכל שאר פרטי המחיר נגזרים בשרת מהמחירון המרכזי, לא מהלקוח —
   * ונשמרים כ-snapshot. שינוי עתידי במחירון לא ישפיע על בקשה שכבר נפתחה.
   */
  const cycle = toBillingCycle(parsed.data.cycle);
  const snapshot = buildPriceSnapshot(parsed.data.planId, cycle);

  const ip = await clientIp();
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) || "";
  const acceptedAt = new Date().toISOString();
  const phone = parsed.data.phone?.trim() || "";
  const reference = buildReference(viewer.id, plan.id);

  if (viewer.demo) {
    return NextResponse.json({ reference, status: "pending_admin_review", demo: true });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  // בקשה פתוחה קיימת לאותו מסלול מנוצלת מחדש, כדי לא להציף את המנהל בכפילויות.
  const { data: existing } = await admin
    .from("payment_requests")
    .select("id,reference,status")
    .eq("user_id", viewer.id)
    .eq("plan_id", plan.id)
    .eq("billing_cycle", cycle)
    .in("status", ["pending_admin_review", "awaiting_payment_link", "payment_link_sent", "customer_reported_paid", "payment_verification"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ reference: existing.reference, status: existing.status, reused: true });
  }

  const { data: acceptanceReference } = await admin.rpc("record_legal_acceptance", {
    target_user: viewer.id,
    acceptance_context: "plan",
    accepted_version: LEGAL_VERSION,
    client_ip: ip,
    client_agent: userAgent || null,
    target_plan: plan.id,
  });
  const legalReference = typeof acceptanceReference === "string" ? acceptanceReference : null;

  const { error } = await admin.from("payment_requests").insert({
    user_id: viewer.id,
    reference,
    plan_id: plan.id,
    amount: snapshot.totalAmount,
    billing_cycle: cycle,
    method: "bit",
    status: "pending_admin_review",
    contact_phone: phone,
    note: parsed.data.note || "",
    plan_name_snapshot: snapshot.planNameSnapshot,
    price_before_discount: snapshot.priceBeforeDiscount,
    discount_amount: snapshot.discountAmount,
    currency: snapshot.currency,
    vat_included: snapshot.vatIncluded,
    cards_included: snapshot.cardsIncluded,
    features_snapshot: snapshot.featuresSnapshot,
    pricing_version: snapshot.pricingVersion,
    terms_version: LEGAL_VERSION,
    legal_reference: legalReference,
    terms_accepted_at: acceptedAt,
  });
  if (error) return NextResponse.json({ error: "לא הצלחנו לפתוח את בקשת הרכישה" }, { status: 500 });

  /*
   * בחירת מסלול בתשלום עוברת את שער ההצטרפות, אבל לא פותחת גישה:
   * effective_plan נשאר 'none' עד לאישור המנהל. בלי הסימון הזה לקוח
   * שבחר מסלול בתשלום היה נזרק חזרה לשער בכל כניסה.
   */
  // רכישת כרטיס נוסף אינה בחירת מסלול, ואסור לה לשנות את המסלול הקיים.
  if (!extra) {
    await admin.rpc("mark_plan_selected", { target_user: viewer.id, target_plan: plan.id });
  }

  if (phone) {
    await admin.from("profiles").update({ phone, updated_at: new Date().toISOString() }).eq("id", viewer.id);
  }

  // תיעוד ההסכמה נשלח בנפרד מבקשת הרכישה: הוא ראיה משפטית, ולא הודעה
  // תפעולית שאפשר למחוק אחרי שהתשלום אושר.
  await sendLegalAcceptanceNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    customerPhone: phone,
    context: "plan",
    contextLabel: "בחירת מסלול בתשלום",
    planName: plan.name,
    cycle,
    amount: snapshot.totalAmount,
    documentVersion: LEGAL_VERSION,
    documents: bindingDocumentIds,
    acceptedAt,
    reference: legalReference || undefined,
    ip,
    userAgent,
  }).catch(() => null);

  // אישור ללקוח שהבקשה התקבלה — לא שהחבילה פעילה.
  await sendPurchaseRequestReceived({
    to: viewer.email,
    customerName: viewer.fullName,
    planName: plan.name,
    amount: snapshot.totalAmount,
    cycle,
    reference,
  }).catch(() => null);

  // המנהל מקבל התראה כדי שלא יצטרך לרענן את מסך התשלומים.
  await sendPaymentRequestNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    planName: plan.name,
    amount: snapshot.totalAmount,
    cycle,
    reference,
  }).catch(() => null);

  return NextResponse.json({ reference, status: "pending_admin_review" });
}
