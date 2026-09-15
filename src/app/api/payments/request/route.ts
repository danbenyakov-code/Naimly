import { NextResponse } from "next/server";
import { z } from "zod";
import { billing, cycleAmount, extraCardProduct, isBillingConfigured, isExtraCard, plans, toBillingCycle } from "@/lib/config";
import { getViewer } from "@/lib/data";
import { buildReference, whatsappPaymentLink } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bindingDocumentIds, LEGAL_VERSION } from "@/lib/legal";
import { adminNotificationEmail } from "@/lib/config";
import { sendLegalAcceptanceNotification, sendPaymentRequestNotification } from "@/lib/email";

const schema = z.object({
  planId: z.enum(["basic", "pro", "premium", "extra_card"]),
  cycle: z.enum(["monthly", "annual"]).optional(),
  phone: z.string().max(30).optional(),
  note: z.string().max(500).optional(),
});

/**
 * פותח בקשת תשלום בביט. אין כאן סליקה — נוצרת רשומה במעקב עם אסמכתא,
 * והלקוח מועבר לוואטסאפ כדי להשלים את ההעברה מול העסק. ההפעלה בפועל
 * מתבצעת רק לאחר אישור ידני של מנהל.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "יש להתחבר לפני התשלום" }, { status: 401 });

  const limited = rateLimit(`payreq:${viewer.id}`, 10, 600);
  if (!limited.ok) return tooManyRequests(limited, "נפתחו יותר מדי בקשות תשלום ברצף. נסו שוב בעוד מספר דקות.");

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
  if (!isBillingConfigured) {
    return NextResponse.json({ error: "מספר הוואטסאפ לתשלומים טרם הוגדר במערכת. יש לפנות לתמיכה." }, { status: 503 });
  }

  /*
   * הסכום נגזר בשרת מהמסלול וממחזור החיוב, ולא מתקבל מהלקוח. מחיר
   * שמגיע מהדפדפן הוא הצעה, לא עובדה.
   */
  const cycle = toBillingCycle(parsed.data.cycle);
  const amount = cycleAmount(plan.price, cycle);

  /*
   * פרטי ההסכמה נקבעים כאן, לפני בניית ההודעה, כדי שההודעה שהלקוח
   * שולח בוואטסאפ תישא בדיוק את אותה גרסה ואותו מועד שנרשמים במסד.
   */
  const ip = await clientIp();
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) || "";
  const acceptedAt = new Date().toISOString();
  const phone = parsed.data.phone?.trim() || "";

  const messageBase = {
    plan,
    viewer,
    cycle,
    phone,
    termsVersion: LEGAL_VERSION,
    acceptedAt,
  } as const;

  const reference = buildReference(viewer.id, plan.id);
  const link = whatsappPaymentLink({ ...messageBase, reference });

  if (viewer.demo) {
    return NextResponse.json({ reference, whatsappUrl: link, bitPhone: billing.bitPhone, demo: true });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  // בקשה פתוחה קיימת לאותו מסלול מנוצלת מחדש, כדי לא להציף את המנהל בכפילויות.
  const { data: existing } = await admin
    .from("payment_requests")
    .select("id,reference")
    .eq("user_id", viewer.id)
    .eq("plan_id", plan.id)
    .eq("billing_cycle", cycle)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      reference: existing.reference,
      whatsappUrl: whatsappPaymentLink({ ...messageBase, reference: existing.reference }),
      bitPhone: billing.bitPhone,
      reused: true,
    });
  }

  const { error } = await admin.from("payment_requests").insert({
    user_id: viewer.id,
    reference,
    plan_id: plan.id,
    amount,
    billing_cycle: cycle,
    method: "bit",
    status: "pending",
    contact_phone: phone,
    note: parsed.data.note || "",
  });
  if (error) return NextResponse.json({ error: "לא הצלחנו לפתוח את בקשת התשלום" }, { status: 500 });

  /*
   * בחירת מסלול בתשלום עוברת את שער ההצטרפות, אבל לא פותחת גישה:
   * effective_plan נשאר 'none' עד לאישור המנהל. בלי הסימון הזה לקוח
   * שבחר מסלול בתשלום היה נזרק חזרה לשער בכל כניסה.
   */
  // רכישת כרטיס נוסף אינה בחירת מסלול, ואסור לה לשנות את המסלול הקיים.
  if (!extra) {
    await admin.rpc("mark_plan_selected", { target_user: viewer.id, target_plan: plan.id });
  }

  // תיעוד ההסכמה למסמכים, עם גרסה ו-IP. ראיה, לא תיבת סימון בממשק.
  // REQ-012: המסלול נרשם יחד עם ההסכמה, ומוחזר מזהה קצר לציטוט.
  const { data: acceptanceReference } = await admin.rpc("record_legal_acceptance", {
    target_user: viewer.id,
    acceptance_context: "plan",
    accepted_version: LEGAL_VERSION,
    client_ip: ip,
    client_agent: userAgent || null,
    target_plan: plan.id,
  });

  if (phone) {
    await admin.from("profiles").update({ phone, updated_at: new Date().toISOString() }).eq("id", viewer.id);
  }

  // תיעוד ההסכמה נשלח בנפרד מבקשת התשלום: הוא ראיה משפטית, ולא
  // הודעה תפעולית שאפשר למחוק אחרי שהתשלום אושר.
  await sendLegalAcceptanceNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    customerPhone: phone,
    context: "plan",
    contextLabel: "בחירת מסלול בתשלום",
    planName: plan.name,
    cycle,
    amount,
    documentVersion: LEGAL_VERSION,
    documents: bindingDocumentIds,
    acceptedAt,
    reference: typeof acceptanceReference === "string" ? acceptanceReference : undefined,
    ip,
    userAgent,
  }).catch(() => null);

  // המנהל מקבל התראה כדי שלא יצטרך לרענן את מסך האישורים.
  await sendPaymentRequestNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    planName: plan.name,
    amount,
    cycle,
    reference,
  }).catch(() => null);

  return NextResponse.json({ reference, whatsappUrl: link, bitPhone: billing.bitPhone });
}
