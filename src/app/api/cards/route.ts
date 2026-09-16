import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import type { PlanId } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cardSchema, missingForPublish } from "@/lib/validation";
import { cardToDatabaseRow } from "@/lib/card-row";
import { effectiveMaxCards, lockMessages, planName, requiredPlanForFeature, requiredPlanForLimit, resolveAccess } from "@/lib/plan-access";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { requiresLegalReAcceptance } from "@/lib/legal";
import { hasUsableContactForm, unusableFormMessage } from "@/lib/contact-form";

/** תווית קריאה לכל שדה, כדי שהשגיאה תגיד "תמונת שיתוף" ולא "socialImageUrl". */
const fieldLabels: Record<string, string> = {
  businessName: "שם העסק", ownerName: "שם מלא", slug: "כתובת הכרטיס",
  phone: "טלפון", whatsapp: "וואטסאפ", email: "אימייל", website: "אתר",
  avatarUrl: "תמונת פרופיל", coverUrl: "תמונת קאבר", logoUrl: "לוגו",
  videoUrl: "קישור לסרטון", videos: "סרטונים", openingHours: "שעות פעילות", socialImageUrl: "תמונת שיתוף", gallery: "גלריה",
  files: "קבצים", socialLinks: "רשתות חברתיות", quickActions: "פעולות מהירות",
  smartButtons: "כפתורים חכמים", seoTitle: "כותרת SEO", seoDescription: "תיאור SEO",
  areaServed: "אזור שירות", tracking: "מדידה", cardAddress: "כתובת",
};

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  /*
   * אותה חסימה כמו בשער הכניסה, גם כאן. חסימה בממשק בלבד היא הצגה:
   * בקשה ישירה ל-API הייתה עוקפת אותה ומאפשרת להמשיך לעבוד תחת נוסח
   * שלא אושר.
   */
  if (!viewer.demo && requiresLegalReAcceptance(viewer.termsVersion)) {
    return NextResponse.json({
      error: "פורסם נוסח מעודכן של תנאי השימוש. יש לאשר אותו לפני שמירת שינויים.",
      reason: "terms_outdated",
      acceptUrl: "/legal/accept",
    }, { status: 403 });
  }

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
  if (!parsed.success) {
    /*
     * QA-031: עד כה הוחזרה הודעה גנרית בלי שם שדה, ולכן הממשק לא יכול
     * היה לסמן aria-invalid או להעביר מיקוד — המשתמש ראה "כתובת חייבת
     * להתחיל ב-http" ולא ידע איפה.
     */
    const issue = parsed.error.issues[0];
    const field = issue?.path.map(String).join(".") || "";
    return NextResponse.json({
      error: issue?.message || "הנתונים אינם תקינים",
      field,
      fieldLabel: fieldLabels[issue?.path[0] as string] || field,
      issues: parsed.error.issues.map((item) => ({ field: item.path.map(String).join("."), message: item.message })),
    }, { status: 400 });
  }
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
  /*
   * מכסת הסרטונים נאכפת גם כאן ולא רק במסד: השכבה הזו מחזירה הודעה
   * שאומרת לאיזה מסלול לשדרג, בעוד המסד רק דוחה.
   */
  const requestedVideos = parsed.data.videos.filter(Boolean);
  if (!features.video && (requestedVideos.length > 0 || parsed.data.videoUrl)) {
    return denied("וידג׳ט הסרטון זמין במסלול מקצועי ומעלה", requiredPlanForFeature("video"), "video");
  }
  if (requestedVideos.length > limits.videos) {
    return denied(`במסלול ${currentPlanName} ניתן להוסיף עד ${limits.videos} ${limits.videos === 1 ? "סרטון" : "סרטונים"}`, requiredPlanForLimit("videos", requestedVideos.length), "video");
  }

  if (!features.tracking && Object.values(parsed.data.tracking).some(Boolean)) {
    return denied("חיבור Meta Pixel ו‑Google Analytics זמין במסלול מקצועי ומעלה", requiredPlanForFeature("tracking"), "tracking");
  }
  if (!features.hours && parsed.data.openingHours.length > 0) {
    return denied("שעות פעילות זמינות במסלול מקצועי ומעלה", requiredPlanForFeature("hours"), "hours");
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
  /*
   * QA-018/QA-032: טיוטה חלקית נשמרת, פרסום חלקי נחסם. האכיפה כאן ולא
   * רק בממשק — בקשה ישירה ל-API עוקפת כל נעילה בצד הלקוח.
   */
  if (parsed.data.isPublished) {
    /*
     * QA-008: כרטיס עם טופס בלי שדה למילוי אינו ניתן לפרסום. האכיפה
     * כאן ובמסד — בקשה ישירה ל-API עוקפת כל בדיקה בממשק.
     */
    if (!hasUsableContactForm(parsed.data.contactFormFields)) {
      return NextResponse.json({
        error: unusableFormMessage,
        field: "contactFormFields",
        fieldLabel: "טופס הפניות",
        reason: "incomplete",
      }, { status: 400 });
    }

    const missing = missingForPublish(parsed.data);
    if (missing.length) {
      return NextResponse.json({
        error: `כדי לפרסם יש להשלים: ${missing.map((item) => item.label).join(", ")}`,
        field: missing[0].key,
        fieldLabel: missing[0].label,
        reason: "incomplete",
        missing: missing.map((item) => ({ field: item.key, label: item.label })),
      }, { status: 400 });
    }
  }

  if (viewer.demo) return NextResponse.json({ card: { ...parsed.data, id: parsed.data.id || "demo-card", updatedAt: new Date().toISOString() }, demo: true });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });
  const row = cardToDatabaseRow(parsed.data, viewer.id);
  if (!parsed.data.id) {
    const { count } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", viewer.id);
    const maxCards = effectiveMaxCards(viewer);
    if ((count || 0) >= maxCards) return denied(`החשבון שלך מאפשר עד ${maxCards} כרטיסים`, requiredPlanForLimit("cards", (count || 0) + 1), "cards");
  }
  const query = parsed.data.id
    ? supabase.from("cards").update(row).eq("id", parsed.data.id).eq("user_id", viewer.id).select("id,slug").single()
    : supabase.from("cards").insert(row).select("id,slug").single();
  const { data, error } = await query;
  if (error?.code === "23505") {
    return NextResponse.json({ error: "הקישור שבחרת כבר תפוס. נסה כתובת אחרת.", field: "slug", fieldLabel: "כתובת הכרטיס" }, { status: 409 });
  }

  /*
   * QA-032: השמירה "נכשלה בשקט". הטריגר enforce_plan_limits מחזיר הודעה
   * במבנה PLAN_LIMIT:<תחום>:<טקסט>, שנבלעה בהודעה גנרית. בנוסף, כש-RLS
   * מסננת את השורה מתקבל data ריק — והשורה שאחריה ניגשה ל-data.slug
   * וזרקה, כך שהתשובה לא הייתה JSON כלל והלקוח לא הציג דבר.
   */
  const errorId = randomUUID().slice(0, 8);
  if (error) {
    const planLimit = /PLAN_LIMIT:([a-z]+):(.*)/i.exec(error.message);
    if (planLimit) {
      return NextResponse.json({ error: planLimit[2].trim(), reason: "plan_limit", feature: planLimit[1], upgradeTo: "pro" }, { status: 403 });
    }
    console.error(`[cards:save] ${errorId} user=${viewer.id} code=${error.code} ${error.message}`);
    return NextResponse.json({
      error: "לא הצלחנו לשמור את הכרטיס. הנתונים שלך נשארו במסך.",
      errorId,
    }, { status: 500 });
  }
  if (!data) {
    console.error(`[cards:save] ${errorId} user=${viewer.id} — לא הוחזרה שורה אחרי הכתיבה`);
    return NextResponse.json({
      error: "השמירה לא הושלמה. הנתונים שלך נשארו במסך — אפשר לנסות שוב.",
      errorId,
    }, { status: 500 });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/card");
  revalidatePath(`/${data.slug}`);
  return NextResponse.json({ card: { ...parsed.data, id: data.id, updatedAt: new Date().toISOString() } });
}
