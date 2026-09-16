import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { leadSchema } from "@/lib/validation";
import { sendLeadNotification } from "@/lib/email";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { HONEYPOT_FIELD, looksLikeBot } from "@/lib/honeypot";

export async function POST(request: Request) {
  const ip = await clientIp();
  const perIp = rateLimit(`lead:ip:${ip}`, 5, 600);
  if (!perIp.ok) return tooManyRequests(perIp, "נשלחו יותר מדי פניות מהמכשיר הזה. נסו שוב בעוד מספר דקות.");
  const payload = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "הפרטים אינם תקינים" }, { status: 400 });
  /*
   * QA-006: שדה המלכודת נקרא קודם "website" — אסימון autofill תקני.
   * דפדפן שמילא אותו גרם לדחיית פנייה אמיתית בשקט, עם תשובת הצלחה.
   */
  if (looksLikeBot(parsed.data[HONEYPOT_FIELD])) {
    console.warn(`[leads] honeypot slug=${parsed.data.slug}`);
    return NextResponse.json({ ok: true });
  }
  const perCard = rateLimit(`lead:card:${parsed.data.slug}`, 40, 3600);
  if (!perCard.ok) return tooManyRequests(perCard, "הכרטיס קיבל יותר מדי פניות בשעה האחרונה. נסו שוב מאוחר יותר.");
  if (!isSupabaseAdminConfigured) return NextResponse.json({ ok: true, demo: true });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "השירות אינו זמין" }, { status: 503 });
  const { data: card } = await admin.from("cards").select("id,user_id,business_name,lead_notification_email,lead_notifications_enabled").eq("slug", parsed.data.slug).eq("is_published", true).maybeSingle();
  if (!card) return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  /*
   * QA-033: הליד נשמר תחילה, ורק אחר כך נשלחת ההתראה. הסדר הזה הוא
   * מה שמבטיח שכשל במייל לעולם אינו מאבד פנייה.
   */
  const { data: lead, error } = await admin
    .from("leads")
    .insert({ card_id: card.id, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email || null, message: parsed.data.message, metadata: parsed.data.fields || {}, status: "new" })
    .select("id")
    .single();
  if (error) {
    /*
     * QA-013: הודעה גנרית בלי מזהה אינה ניתנת לאיתור בלוג. הפרטים
     * נשארים בטופס, ולמשתמש יש מה למסור בפנייה לתמיכה.
     */
    const errorId = randomUUID().slice(0, 8);
    console.error(`[leads:save] ${errorId} slug=${parsed.data.slug} code=${error.code} ${error.message}`);
    return NextResponse.json({
      error: "לא הצלחנו לשמור את הפנייה. הפרטים נשארו בטופס — אפשר לנסות שוב, או ליצור קשר בטלפון או בוואטסאפ.",
      errorId,
    }, { status: 500 });
  }
  await admin.from("card_events").insert({ card_id: card.id, event_type: "lead", metadata: {} });
  /*
   * QA-033: היעד ניתן להגדרה ולכיבוי. ריק = כתובת בעל החשבון, כדי
   * שכרטיסים קיימים ימשיכו לעבוד בלי שינוי.
   * הליד כבר נשמר בשלב הזה — ההתראה לעולם אינה תנאי לשמירתו.
   */
  if (card.lead_notifications_enabled === false) {
    // כבוי במכוון — לא כשל, ולכן סטטוס נפרד.
    if (lead) await admin.from("leads").update({ notification_status: "skipped", notification_at: new Date().toISOString() }).eq("id", lead.id);
    return NextResponse.json({ ok: true });
  }

  const { data: owner } = await admin.from("profiles").select("email").eq("id", card.user_id).maybeSingle();
  const target = String(card.lead_notification_email || "").trim() || owner?.email || "";

  // ההתראה לא חוסמת את התשובה ללקוח — פנייה נשמרת גם אם המייל נכשל.
  const delivery = await sendLeadNotification({
    to: target,
    businessName: card.business_name,
    cardSlug: parsed.data.slug,
    lead: { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, message: parsed.data.message },
  }).catch((caught) => ({ sent: false as const, reason: "provider_error" as const, detail: String(caught) }));

  /*
   * סטטוס המסירה נשמר כדי שתקלה לא תהיה בלתי נראית. הסיבה בלבד —
   * לעולם לא תוכן הפנייה, שאין לו מה לעשות בשדה אבחון.
   */
  if (lead) {
    await admin.from("leads").update({
      notification_status: delivery.sent ? "sent" : "failed",
      notification_error: delivery.sent ? null : `${delivery.reason}${delivery.detail ? `: ${delivery.detail.slice(0, 200)}` : ""}`,
      notification_at: new Date().toISOString(),
    }).eq("id", lead.id);
  }

  if (!delivery.sent) {
    console.error(`[leads:notify] slug=${parsed.data.slug} reason=${delivery.reason}`);
  }

  return NextResponse.json({ ok: true });
}
