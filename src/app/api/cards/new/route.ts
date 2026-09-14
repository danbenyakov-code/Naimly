import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/data";
import { starterCard } from "@/lib/starter-card";
import { cardToDatabaseRow } from "@/lib/card-row";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planLimits, planName, requiredPlanForLimit, resolveAccess } from "@/lib/plan-access";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { requiresLegalReAcceptance } from "@/lib/legal";

/**
 * יצירת כרטיס נוסף בחשבון (REQ-011).
 *
 * נתיב נפרד ולא חלק מהשמירה הרגילה: יצירה היא פעולה שמושפעת ממכסת
 * המסלול, ולא כדאי שהיא תלויה בתקינות טופס שלם. הכרטיס נוצר ריק,
 * והמשתמש ממלא אותו בעורך.
 *
 * הכתובת מקבלת סיומת מספרית כדי שלא תתנגש בכרטיס הקיים. התנגשות
 * אמיתית עדיין אפשרית מול משתמש אחר, ולכן היא נתפסת ומוחזרת בבירור.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  if (!viewer.demo && requiresLegalReAcceptance(viewer.termsVersion)) {
    return NextResponse.json({
      error: "פורסם נוסח מעודכן של תנאי השימוש. יש לאשר אותו לפני יצירת כרטיס.",
      reason: "terms_outdated",
      acceptUrl: "/legal/accept",
    }, { status: 403 });
  }

  const access = resolveAccess(viewer);
  if (access.locked) {
    return NextResponse.json({ error: "המסלול אינו פעיל. יש לבחור מסלול כדי ליצור כרטיס.", locked: true }, { status: 402 });
  }

  const limited = rateLimit(`card-create:${viewer.id}`, 5, 600);
  if (!limited.ok) return tooManyRequests(limited, "נוצרו יותר מדי כרטיסים ברצף. אפשר לנסות שוב בעוד מספר דקות.");

  if (viewer.demo) {
    return NextResponse.json({ error: "במצב הדגמה אי אפשר ליצור כרטיס נוסף." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  const limits = planLimits(access.plan);
  const { count } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", viewer.id);
  const existing = count || 0;

  if (existing >= limits.cards) {
    return NextResponse.json({
      error: `מסלול ${planName(access.plan)} מאפשר עד ${limits.cards} ${limits.cards === 1 ? "כרטיס" : "כרטיסים"}.`,
      reason: "plan_limit",
      feature: "cards",
      upgradeTo: requiredPlanForLimit("cards", existing + 1),
    }, { status: 403 });
  }

  const blank = starterCard(viewer);
  const row = cardToDatabaseRow({ ...blank, slug: `${blank.slug}-${existing + 1}`, isPublished: false }, viewer.id);

  const { data, error } = await supabase.from("cards").insert(row).select("id,slug").single();

  if (error?.code === "23505") {
    // התנגשות כתובת מול משתמש אחר: ניסיון שני עם סיומת אקראית קצרה.
    const retrySlug = `${blank.slug}-${Math.random().toString(36).slice(2, 6)}`;
    const retry = await supabase
      .from("cards")
      .insert(cardToDatabaseRow({ ...blank, slug: retrySlug, isPublished: false }, viewer.id))
      .select("id,slug")
      .single();
    if (retry.error || !retry.data) {
      return NextResponse.json({ error: "לא הצלחנו ליצור כרטיס נוסף. אפשר לנסות שוב." }, { status: 500 });
    }
    revalidatePath("/dashboard/card");
    return NextResponse.json({ id: retry.data.id, slug: retry.data.slug });
  }

  if (error || !data) {
    // מגבלת המסד מוחזרת בפורמט PLAN_LIMIT, ולא כשגיאה גנרית.
    const planLimit = error ? /PLAN_LIMIT:([a-z]+):(.*)/i.exec(error.message) : null;
    if (planLimit) {
      return NextResponse.json({ error: planLimit[2].trim(), reason: "plan_limit", feature: planLimit[1] }, { status: 403 });
    }
    return NextResponse.json({ error: "לא הצלחנו ליצור כרטיס נוסף. אפשר לנסות שוב." }, { status: 500 });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/card");
  return NextResponse.json({ id: data.id, slug: data.slug });
}
