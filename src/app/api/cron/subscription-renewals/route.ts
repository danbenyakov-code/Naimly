import { NextResponse } from "next/server";
import { adminNotificationEmail, cycleAmount, plans } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRenewalReminderAdminNotification, sendRenewalReminderNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

/** כמה ימים לפני תפוגה נשלחת התזכורת. */
const REMINDER_WINDOW_DAYS = 7;

type Row = {
  user_id: string;
  plan_id: string;
  billing_cycle: string | null;
  current_period_end: string;
  renewal_reminder_period_end: string | null;
  profiles: { full_name?: string | null; email?: string | null } | null;
};

/**
 * Vercel Cron, פעם ביום. שני תפקידים:
 *
 * 1. תזכורת חידוש ללקוח ולאדמין, פעם אחת לכל current_period_end —
 *    לא בכל ריצה. כשהמנוי מתחדש התאריך משתנה והתזכורת חוזרת אוטומטית.
 * 2. שום דבר מעבר לזה: תפוגה בפועל נאכפת כבר ב-effective_plan()
 *    (מיגרציה 030) לפי current_period_end, בלי תלות בקרון הזה בכלל.
 *    אם הקרון לא רץ יום אחד, אף לקוח לא "נשאר פתוח" בטעות — לכל היותר
 *    מפספס תזכורת.
 *
 * מוגן ב-CRON_SECRET: Vercel שולח Authorization: Bearer <הסוד> אוטומטית
 * לקריאות מתוזמנות. בלי הסוד מוגדר, הנתיב חסום לגמרי — לא פתוח בטעות.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET אינו מוגדר" }, { status: 503 });
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 86400000);

  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id,plan_id,billing_cycle,current_period_end,renewal_reminder_period_end,profiles(full_name,email)")
    .eq("status", "active")
    .eq("admin_locked", false)
    .gte("current_period_end", now.toISOString())
    .lte("current_period_end", windowEnd.toISOString());

  if (error) return NextResponse.json({ error: "השאילתה נכשלה" }, { status: 500 });

  const rows = (data || []) as unknown as Row[];
  let sent = 0;
  const failures: string[] = [];

  for (const row of rows) {
    // כבר נשלחה תזכורת בדיוק לתאריך התפוגה הזה — לא שולחים שוב בכל ריצה יומית.
    if (row.renewal_reminder_period_end === row.current_period_end) continue;

    const plan = plans.find((item) => item.id === row.plan_id);
    if (!plan || !row.profiles?.email) continue;

    const cycle = row.billing_cycle === "annual" ? "annual" : "monthly";
    const amount = cycleAmount(plan.price, cycle);
    const daysLeft = Math.max(1, Math.round((new Date(row.current_period_end).getTime() - now.getTime()) / 86400000));

    const customerResult = await sendRenewalReminderNotification({
      to: row.profiles.email,
      customerName: row.profiles.full_name || "לקוח יקר",
      planName: plan.name,
      amount,
      cycle,
      periodEnd: row.current_period_end,
      daysLeft,
    });

    await sendRenewalReminderAdminNotification({
      to: adminNotificationEmail,
      customerName: row.profiles.full_name || "לקוח",
      customerEmail: row.profiles.email,
      planName: plan.name,
      amount,
      periodEnd: row.current_period_end,
      daysLeft,
    }).catch(() => null);

    if (!customerResult.sent) {
      failures.push(row.user_id);
      continue;
    }

    await admin.from("subscriptions").update({ renewal_reminder_period_end: row.current_period_end }).eq("user_id", row.user_id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent, failures });
}
