import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeSlug, isSlugShapeValid, suggestSlugs } from "@/lib/slug";
import { isSlugAllowed, blockedSlugMessage } from "@/lib/slug-policy";
import { reservedSlugs } from "@/lib/validation";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * בדיקת זמינות כתובת (NEW-006).
 *
 * הבדיקה בשרת ולא בלקוח: רשימת הכתובות התפוסות אינה נתון שאפשר לשלוח
 * לדפדפן, והשוואה בצד הלקוח הייתה גם דולפת מידע וגם מתיישנת מיד.
 *
 * הבדיקה כאן אינה תחליף לאינדקס הייחודי במסד — שתי בקשות מקבילות
 * יכולות שתיהן לקבל "פנוי". האינדקס הוא מה שמכריע, והבדיקה הזו נועדה
 * לחסוך למשתמש את הגילוי רק ברגע השמירה.
 */
const schema = z.object({
  slug: z.string().max(80),
  /** הכרטיס הנערך. הכתובת שלו עצמו אינה נחשבת תפוסה. */
  cardId: z.string().max(64).optional(),
  businessName: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const limited = rateLimit(`slug-check:${viewer.id}`, 60, 60);
  if (!limited.ok) return tooManyRequests(limited, "יותר מדי בדיקות ברצף. אפשר לנסות שוב בעוד רגע.");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ state: "invalid" });

  const normalized = normalizeSlug(parsed.data.slug);

  if (!isSlugShapeValid(parsed.data.slug)) {
    return NextResponse.json({ state: "invalid", normalized });
  }
  if (reservedSlugs.has(normalized)) {
    return NextResponse.json({ state: "taken", normalized, reason: "reserved" });
  }
  // REQ-019: מונחים אסורים נחסמים בשרת, לא רק בשמירה.
  if (!isSlugAllowed(normalized)) {
    return NextResponse.json({ state: "invalid", normalized, message: blockedSlugMessage });
  }

  if (viewer.demo) return NextResponse.json({ state: "available", normalized });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ state: "error" });

  /*
   * ההשוואה על הצורה המנורמלת ובאותה רגישות רישיות כמו האינדקס.
   * בדיקה על הערך הגולמי הייתה אומרת "פנוי" לכתובת שהמסד ידחה.
   */
  const { data, error } = await supabase
    .from("cards")
    .select("id")
    .ilike("slug", normalized)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ state: "error" });

  // הכתובת של הכרטיס הנערך עצמו אינה תפוסה עבורו.
  if (data && data.id !== parsed.data.cardId) {
    return NextResponse.json({
      state: "taken",
      normalized,
      suggestions: suggestSlugs(parsed.data.businessName || "", normalized),
    });
  }

  return NextResponse.json({ state: "available", normalized });
}
