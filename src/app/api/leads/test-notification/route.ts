import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { sendLeadNotification } from "@/lib/email";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * שליחת התראת ליד לדוגמה ליעד שהוגדר.
 *
 * QA-033: לא הייתה שום דרך לדעת אם ההתראות באמת מגיעות. עכשיו אפשר
 * לשלוח בדיקה, והצלחה מסומנת ב-lead_notification_verified_at — כלומר
 * "אומת" פירושו שמייל יצא בפועל, לא שהשדה מולא.
 */
const schema = z.object({
  email: z.union([z.literal(""), z.string().email("כתובת האימייל אינה תקינה").max(160)]),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  const ip = await clientIp();
  const limited = rateLimit(`lead-test:${viewer.id}:${ip}`, 3, 900);
  if (!limited.ok) return tooManyRequests(limited, "נשלחו יותר מדי מיילי בדיקה. אפשר לנסות שוב בעוד מספר דקות.");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message || "הפרטים אינם תקינים",
      field: "leadNotificationEmail",
      fieldLabel: "יעד התראות",
    }, { status: 400 });
  }

  const target = parsed.data.email.trim() || viewer.email;
  if (!target) return NextResponse.json({ error: "לא נמצאה כתובת יעד לשליחה" }, { status: 400 });

  if (!isSupabaseAdminConfigured) return NextResponse.json({ ok: true, demo: true, target });

  const result = await sendLeadNotification({
    to: target,
    businessName: viewer.fullName || "הכרטיס שלך",
    lead: {
      name: "פנייה לדוגמה",
      phone: "050-000-0000",
      email: viewer.email,
      message: "זהו מייל בדיקה מ-NAIMLY. אם הוא הגיע — התראות הלידים מוגדרות נכון.",
    },
  });

  // אין מעמידים פנים שנשלח מייל שלא נשלח.
  if (!result.sent) {
    return NextResponse.json({
      error: `לא הצלחנו לשלוח לכתובת ${target}. ${result.reason || ""}`.trim(),
      target,
    }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await admin
      .from("cards")
      .update({ lead_notification_verified_at: new Date().toISOString() })
      .eq("user_id", viewer.id);
  }

  return NextResponse.json({ ok: true, target });
}
