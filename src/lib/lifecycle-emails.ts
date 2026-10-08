/**
 * מי מקבל איזה מייל מחזור חיים, ומתי. פונקציות טהורות, בלי מסד ובלי שליחה.
 *
 * הזמנים מחושבים בתאריכי לוח בשעון ישראל: "3 ימים לפני" פירושו שלושה
 * תאריכים לפני יום הסיום, בלי קשר לשעה ביום שבה הניסיון התחיל.
 */
import { planState, toNumber, type UserOverviewRow } from "@/lib/user-control";
import type { TrialEmailKind } from "@/emails/trial-email";

const DAY = 86400000;
const israelDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
const israelHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" });
const israelWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" });

/** YYYY-MM-DD בשעון ישראל. */
export function israelDay(ms: number) {
  return israelDate.format(ms);
}

export function israelHourOf(ms: number) {
  return Number(israelHour.format(ms));
}

export function isIsraelSunday(ms: number) {
  return israelWeekday.format(ms) === "Sun";
}

/** כמה תאריכי לוח מ-from עד to (שלילי כשעבר). */
export function calendarDaysBetween(fromMs: number, toMs: number) {
  const from = Date.parse(`${israelDay(fromMs)}T00:00:00Z`);
  const to = Date.parse(`${israelDay(toMs)}T00:00:00Z`);
  return Math.round((to - from) / DAY);
}

/** כמה זמן אחרי סוף הניסיון עוד שולחים "הניסיון הסתיים" (אם ריצה אחת פוספסה). */
const ENDED_GRACE_MS = 3 * DAY;

export type TrialDecision = { kind: TrialEmailKind; daysLeft: number } | { kind: null; reason: string };

/**
 * המייל שמגיע ללקוח היום, אם בכלל. כל סוג נשלח פעם אחת בלבד (sentKeys
 * מגיע מהיומן), ולא שולחים את "3 ימים" אחרי ש"יום אחד" כבר יצא.
 */
export function decideTrialEmail(row: UserOverviewRow, sentKeys: Set<string>, now: number): TrialDecision {
  if (row.role === "admin") return { kind: null, reason: "admin" };
  if (!row.email) return { kind: null, reason: "no_email" };
  if (!row.trial_started_at || !row.trial_ends_at) return { kind: null, reason: "no_trial" };
  // "לא לשלוח למי שכבר שילם", וגם לא למי שכבר ביקש לשלם וממתין לאישור.
  if (row.first_payment_at || planState(row, now) === "paying") return { kind: null, reason: "paid" };
  if (row.open_payment_status) return { kind: null, reason: "payment_pending" };
  if (row.admin_locked) return { kind: null, reason: "locked" };

  const end = Date.parse(row.trial_ends_at);
  if (!Number.isFinite(end)) return { kind: null, reason: "no_trial" };

  if (end <= now) {
    if (now - end > ENDED_GRACE_MS) return { kind: null, reason: "ended_long_ago" };
    if (sentKeys.has("trial_ended")) return { kind: null, reason: "already_sent" };
    return { kind: "trial_ended", daysLeft: 0 };
  }

  const daysLeft = calendarDaysBetween(now, end);
  if (daysLeft <= 1) {
    if (sentKeys.has("trial_ending_1d")) return { kind: null, reason: "already_sent" };
    return { kind: "trial_ending_1d", daysLeft };
  }
  if (daysLeft <= 3) {
    if (sentKeys.has("trial_ending_3d") || sentKeys.has("trial_ending_1d")) return { kind: null, reason: "already_sent" };
    return { kind: "trial_ending_3d", daysLeft };
  }
  return { kind: null, reason: "not_yet" };
}

/** מפתח השבוע של הדוח: תאריך יום ראשון בשעון ישראל. */
export function weekKey(now: number) {
  return israelDay(now);
}

export type WeeklyDecision = { send: true } | { send: false; reason: string };

/** הדוח השבועי: ניסיון פעיל, כרטיס מפורסם, ולא נשלח כבר השבוע. */
export function decideWeeklyReport(row: UserOverviewRow, sentWeeks: Set<string>, now: number): WeeklyDecision {
  if (row.role === "admin") return { send: false, reason: "admin" };
  if (!row.email) return { send: false, reason: "no_email" };
  if (planState(row, now) !== "trial") return { send: false, reason: "not_in_trial" };
  if (toNumber(row.published_count) === 0) return { send: false, reason: "not_published" };
  if (sentWeeks.has(weekKey(now))) return { send: false, reason: "already_sent" };
  return { send: true };
}

/** השם הפרטי לפנייה במייל. */
export function firstName(fullName: string | null | undefined) {
  return (fullName || "").trim().split(/\s+/)[0] || "";
}
