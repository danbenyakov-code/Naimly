import { NextResponse } from "next/server";
import { z } from "zod";
import { billing, isBillingConfigured, plans } from "@/lib/config";
import { getViewer } from "@/lib/data";
import { buildReference, whatsappPaymentLink } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { LEGAL_VERSION } from "@/lib/legal";
import { adminNotificationEmail } from "@/lib/config";
import { sendPaymentRequestNotification } from "@/lib/email";

const schema = z.object({
  planId: z.enum(["basic", "pro", "premium"]),
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

  const plan = plans.find((item) => item.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 404 });
  if (!isBillingConfigured) {
    return NextResponse.json({ error: "מספר הוואטסאפ לתשלומים טרם הוגדר במערכת. יש לפנות לתמיכה." }, { status: 503 });
  }

  const reference = buildReference(viewer.id, plan.id);
  const link = whatsappPaymentLink({ plan, viewer, reference });

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
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      reference: existing.reference,
      whatsappUrl: whatsappPaymentLink({ plan, viewer, reference: existing.reference }),
      bitPhone: billing.bitPhone,
      reused: true,
    });
  }

  const { error } = await admin.from("payment_requests").insert({
    user_id: viewer.id,
    reference,
    plan_id: plan.id,
    amount: plan.price,
    method: "bit",
    status: "pending",
    contact_phone: parsed.data.phone || "",
    note: parsed.data.note || "",
  });
  if (error) return NextResponse.json({ error: "לא הצלחנו לפתוח את בקשת התשלום" }, { status: 500 });

  /*
   * בחירת מסלול בתשלום עוברת את שער ההצטרפות, אבל לא פותחת גישה:
   * effective_plan נשאר 'none' עד לאישור המנהל. בלי הסימון הזה לקוח
   * שבחר מסלול בתשלום היה נזרק חזרה לשער בכל כניסה.
   */
  await admin.rpc("mark_plan_selected", { target_user: viewer.id, target_plan: plan.id });

  // תיעוד ההסכמה למסמכים, עם גרסה ו-IP. ראיה, לא תיבת סימון בממשק.
  await admin.rpc("record_legal_acceptance", {
    target_user: viewer.id,
    acceptance_context: "plan",
    accepted_version: LEGAL_VERSION,
    client_ip: await clientIp(),
    client_agent: request.headers.get("user-agent")?.slice(0, 400) || null,
  });

  if (parsed.data.phone) {
    await admin.from("profiles").update({ phone: parsed.data.phone, updated_at: new Date().toISOString() }).eq("id", viewer.id);
  }

  // המנהל מקבל התראה כדי שלא יצטרך לרענן את מסך האישורים.
  await sendPaymentRequestNotification({
    to: adminNotificationEmail,
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    planName: plan.name,
    amount: plan.price,
    reference,
  }).catch(() => null);

  return NextResponse.json({ reference, whatsappUrl: link, bitPhone: billing.bitPhone });
}
