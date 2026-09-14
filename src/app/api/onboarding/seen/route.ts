import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * סימון שההדרכה הראשונית נצפתה.
 *
 * QA-020: המצב נשמר ב-localStorage, ולכן חזר בכל דפדפן ובכל מכשיר.
 * מצב שקשור למשתמש שייך למשתמש, ולא לדפדפן שבו הוא ישב באותו רגע.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  if (viewer.demo || !isSupabaseConfigured) return NextResponse.json({ ok: true, demo: true });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "השירות אינו זמין" }, { status: 503 });

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", viewer.id);

  if (error) return NextResponse.json({ error: "לא הצלחנו לשמור את המצב" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
