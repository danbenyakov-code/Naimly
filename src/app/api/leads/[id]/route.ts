import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["new", "contacted", "closed"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  if (viewer.demo) return NextResponse.json({ ok: true, demo: true });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "השירות אינו זמין" }, { status: 503 });
  const { data: cards } = await supabase.from("cards").select("id").eq("user_id", viewer.id);
  const cardIds = (cards || []).map((card) => card.id);
  const { error } = await supabase.from("leads").update({ status: parsed.data.status }).eq("id", id).in("card_id", cardIds);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
