import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import type { PlanId } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cardSchema } from "@/lib/validation";
import { cardToDatabaseRow } from "@/lib/card-row";
import { lockMessages, planName, requiredPlanForFeature, requiredPlanForLimit, resolveAccess } from "@/lib/plan-access";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const access = resolveAccess(viewer);
  if (access.locked) {
    // לא שילם: הכול חסום, לא רק הפרסום.
    return NextResponse.json({
      error: lockMessages[access.reason],
      reason: access.reason,
      upgradeTo: "basic",
      locked: true,
    }, { status: 402 });
  }

  const limited = rateLimit(`card-save:${viewer.id}`, 60, 300);
  if (!limited.ok) return tooManyRequests(limited, "נשמרו יותר מדי שינויים ברצף. נסו שוב בעוד רגע.");

  const json = await request.json().catch(() => null);
  const parsed = cardSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "הנתונים אינם תקינים", issues: parsed.error.flatten() }, { status: 400 });
  const limits = access.limits;
  const features = access.features;
  const currentPlanName = planName(access.plan);

  // חסימת מסלול. ה‑UI נועל מראש, אבל השרת הוא הגבול האמיתי.
  const denied = (message: string, upgradeTo: PlanId, feature?: string) =>
    NextResponse.json({ error: message, reason: "plan_limit", feature, upgradeTo }, { status: 403 });

  if (parsed.data.gallery.length > limits.galleryItems) {
    return denied(`במסלול ${currentPlanName} ניתן להציג עד ${limits.galleryItems} תמונות בגלריה`, requiredPlanForLimit("galleryItems", parsed.data.gallery.length), "gallery");
  }
  if (parsed.data.quickActions.length > limits.quickActions || parsed.data.quickActionsLimit > limits.quickActions) {
    return denied(`במסלול ${currentPlanName} ניתן להציג עד ${limits.quickActions} פעולות מהירות`, requiredPlanForLimit("quickActions", Math.max(parsed.data.quickActions.length, parsed.data.quickActionsLimit)), "quickActions");
  }
  if (!features.tracking && Object.values(parsed.data.tracking).some(Boolean)) {
    return denied("חיבור Meta Pixel ו‑Google Analytics זמין במסלול מקצועי ומעלה", requiredPlanForFeature("tracking"), "tracking");
  }
  if (!features.seo && (parsed.data.areaServed || parsed.data.socialImageUrl)) {
    return denied("אזור שירות ותמונת שיתוף מותאמת זמינים במסלול מקצועי ומעלה", requiredPlanForFeature("seo"), "seo");
  }
  if (!features.carousel && parsed.data.galleryStyle === "carousel") {
    return denied("גלריית קרוסלה זמינה במסלול מקצועי ומעלה", requiredPlanForFeature("carousel"), "carousel");
  }
  const enabledWidgets = new Set(parsed.data.widgets.filter((widget) => widget.enabled).map((widget) => widget.type));
  if (!features.video && enabledWidgets.has("video")) {
    return denied("וידג׳ט הסרטון זמין במסלול בסיסי ומעלה", requiredPlanForFeature("video"), "video");
  }
  if (!features.files && (enabledWidgets.has("files") || parsed.data.files.length)) {
    return denied("צירוף קבצים להורדה זמין במסלול מקצועי ומעלה", requiredPlanForFeature("files"), "files");
  }
  if (viewer.demo) return NextResponse.json({ card: { ...parsed.data, id: parsed.data.id || "demo-card", updatedAt: new Date().toISOString() }, demo: true });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });
  const row = cardToDatabaseRow(parsed.data, viewer.id);
  if (!parsed.data.id) {
    const { count } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", viewer.id);
    if ((count || 0) >= limits.cards) return denied(`המסלול ${currentPlanName} מאפשר עד ${limits.cards} כרטיסים`, requiredPlanForLimit("cards", (count || 0) + 1), "cards");
  }
  const query = parsed.data.id
    ? supabase.from("cards").update(row).eq("id", parsed.data.id).eq("user_id", viewer.id).select("id,slug").single()
    : supabase.from("cards").insert(row).select("id,slug").single();
  const { data, error } = await query;
  if (error?.code === "23505") return NextResponse.json({ error: "הקישור שבחרת כבר תפוס. נסה כתובת אחרת." }, { status: 409 });
  if (error) return NextResponse.json({ error: "לא הצלחנו לשמור את הכרטיס. הנתונים שלך נשארו במסך." }, { status: 500 });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/card");
  revalidatePath(`/${data.slug}`);
  return NextResponse.json({ card: { ...parsed.data, id: data.id, updatedAt: new Date().toISOString() } });
}
