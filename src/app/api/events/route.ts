import { NextResponse } from "next/server";
import { z } from "zod";
import { demoCard } from "@/lib/demo-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const eventSchema = z.object({
  slug: z.string().min(3).max(60),
  type: z.enum(["view", "qr_scan", "phone", "whatsapp", "whatsapp_primary", "email", "contact_save", "map", "waze", "google_maps", "website", "share", "social", "instagram", "facebook", "linkedin", "tiktok", "youtube", "calendar", "button", "video", "file"]),
  referrer: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const ip = await clientIp();
  // ללא מגבלה אפשר לנפח את דוחות הצפיות של כל כרטיס.
  const limited = rateLimit(`event:${ip}`, 60, 60);
  if (!limited.ok) return tooManyRequests(limited);
  const payload = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isSupabaseAdminConfigured) return NextResponse.json({ ok: parsed.data.slug === demoCard.slug, demo: true });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: card } = await admin.from("cards").select("id").eq("slug", parsed.data.slug).eq("is_published", true).maybeSingle();
  if (!card) return NextResponse.json({ ok: false }, { status: 404 });
  const { error } = await admin.from("card_events").insert({ card_id: card.id, event_type: parsed.data.type, metadata: { referrer: parsed.data.referrer || null } });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
