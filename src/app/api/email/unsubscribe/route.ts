import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * הסרה בלחיצה אחת, בלי התחברות.
 *
 * משרת שני מקורות: כפתור "ביטול הרשמה" של Gmail (RFC 8058: POST לכתובת
 * שבכותרת List-Unsubscribe, עם הטוקן ב-query), ועמוד /unsubscribe/[token]
 * שקורא לכאן מהדפדפן. רק POST: סורקי קישורים במיילים שולחים GET, ואסור
 * שהם יסירו לקוח בלי שלחץ.
 *
 * ההסרה מכבה את כל סוגי הדיוור שאינם קריטיים. מיילים קריטיים ממשיכים.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`unsubscribe:${await clientIp()}`, 20, 600);
  if (!limited.ok) return tooManyRequests(limited);

  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token && request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    token = typeof body?.token === "string" ? body.token : "";
  }
  if (!TOKEN.test(token)) return NextResponse.json({ ok: false, error: "הקישור אינו תקין" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "השירות אינו זמין כרגע" }, { status: 503 });

  const { data, error } = await admin
    .from("email_preferences")
    .update({ trial_reminders: false, weekly_report: false, product_updates: false, marketing: false })
    .eq("unsubscribe_token", token)
    .select("user_id");
  if (error) return NextResponse.json({ ok: false, error: "לא הצלחנו לעדכן. אפשר לנסות שוב." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: false, error: "הקישור אינו תקין או שפג תוקפו" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
