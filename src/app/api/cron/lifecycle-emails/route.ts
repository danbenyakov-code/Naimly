import { NextResponse } from "next/server";
import { israelHourOf } from "@/lib/lifecycle-emails";
import { runLifecycleEmails } from "@/lib/lifecycle-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** השעה בישראל שבה נשלחים המיילים. */
const SEND_HOUR = 9;

/**
 * Vercel Cron: מיילי סיום ניסיון כל יום, ודוח שבועי בימי ראשון, ב-09:00
 * שעון ישראל.
 *
 * הקרון מוגדר פעמיים (06:00 ו-07:00 UTC) כי Vercel עובד ב-UTC וישראל
 * עוברת בין +2 ל-+3. רק הריצה שנופלת על 09:xx בישראל עושה משהו, השנייה
 * מדלגת. מניעת הכפילויות ביומן מכסה גם ריצה כפולה בטעות.
 *
 * מתג חירום: EMAIL_AUTOMATIONS_ENABLED=false הופך כל הרצה ל"יבשה": מחשבת
 * מי היה מקבל מה, ולא שולחת דבר. ברירת המחדל: שולחת.
 *
 * פרמטרים (רק עם הסוד): ?force=1 מדלג על בדיקת השעה, ?dry=1 מכריח הרצה
 * יבשה, ?weekly=1 מריץ גם את הדוח השבועי שלא ביום ראשון.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET אינו מוגדר" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });

  const url = new URL(request.url);
  const now = Date.now();
  if (url.searchParams.get("force") !== "1" && israelHourOf(now) !== SEND_HOUR) {
    return NextResponse.json({ ok: true, skipped: "not_send_hour", israelHour: israelHourOf(now) });
  }

  const enabled = process.env.EMAIL_AUTOMATIONS_ENABLED !== "false";
  const dryRun = !enabled || url.searchParams.get("dry") === "1";

  try {
    const report = await runLifecycleEmails({ dryRun, now, forceWeekly: url.searchParams.get("weekly") === "1" });
    const counts = report.entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`[lifecycle-emails] dry=${dryRun} weekly=${report.weekly} ${JSON.stringify(counts)}`);
    return NextResponse.json({ ok: true, enabled, ...report, counts });
  } catch (error) {
    console.error(`[lifecycle-emails] ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "ההרצה נכשלה" }, { status: 500 });
  }
}
