import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { leadSchema } from "@/lib/validation";
import { sendLeadNotification } from "@/lib/email";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = await clientIp();
  const perIp = rateLimit(`lead:ip:${ip}`, 5, 600);
  if (!perIp.ok) return tooManyRequests(perIp, "נשלחו יותר מדי פניות מהמכשיר הזה. נסו שוב בעוד מספר דקות.");
  const payload = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "הפרטים אינם תקינים" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });
  const perCard = rateLimit(`lead:card:${parsed.data.slug}`, 40, 3600);
  if (!perCard.ok) return tooManyRequests(perCard, "הכרטיס קיבל יותר מדי פניות בשעה האחרונה. נסו שוב מאוחר יותר.");
  if (!isSupabaseAdminConfigured) return NextResponse.json({ ok: true, demo: true });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "השירות אינו זמין" }, { status: 503 });
  const { data: card } = await admin.from("cards").select("id,user_id,business_name").eq("slug", parsed.data.slug).eq("is_published", true).maybeSingle();
  if (!card) return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  const { error } = await admin.from("leads").insert({ card_id: card.id, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email || null, message: parsed.data.message, metadata: parsed.data.fields || {}, status: "new" });
  if (error) return NextResponse.json({ error: "לא הצלחנו לשלוח את הפנייה" }, { status: 500 });
  await admin.from("card_events").insert({ card_id: card.id, event_type: "lead", metadata: {} });
  const { data: owner } = await admin.from("profiles").select("email").eq("id", card.user_id).maybeSingle();
  // ההתראה לא חוסמת את התשובה ללקוח — פנייה נשמרת גם אם המייל נכשל.
  await sendLeadNotification({
    to: owner?.email || "",
    businessName: card.business_name,
    cardSlug: parsed.data.slug,
    lead: { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, message: parsed.data.message },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
