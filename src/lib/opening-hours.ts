/**
 * שעות פעילות מובנות.
 *
 * עד כה השעות נשמרו כטקסט חופשי (`{ day: "ראשון–חמישי", hours: "09:00–18:00" }`).
 * טקסט חופשי אפשר להציג, אבל אי אפשר לגזור ממנו דבר — ולכן התג
 * "זמין לפניות" בכרטיס הוצג תמיד, גם בשבת בחצות. הצהרה שאינה נמדדת על
 * עמוד ציבורי היא אותה בעיה כמו נתוני שיווק שלא נמדדו.
 *
 * המבנה כאן מאפשר לגזור: פתוח עכשיו, מתי נפתח, ואיך להציג בצורה קריאה.
 * הטקסט החופשי נשמר כגיבוי לכרטיסים ותיקים ואינו נמחק.
 */

export type OpeningHours = {
  /** 0 = ראשון … 6 = שבת. */
  day: number;
  closed: boolean;
  /** פתוח כל היממה. כשהוא דולק, open ו-close אינם רלוונטיים. */
  allDay: boolean;
  /** "HH:MM" */
  open: string;
  /** "HH:MM" */
  close: string;
};

export const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const dayNamesShort = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** אזור הזמן העסקי. שעות של עסק ישראלי נמדדות בשעון ישראל. */
export const BUSINESS_TIMEZONE = "Asia/Jerusalem";

/** ברירת מחדל סבירה לעסק ישראלי, כנקודת פתיחה בעורך. */
export function defaultOpeningHours(): OpeningHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    closed: day === 6,
    allDay: false,
    open: "09:00",
    close: day === 5 ? "13:00" : "18:00",
  }));
}

/**
 * "HH:MM" למספר דקות מתחילת היום, או null כשאינו תקין.
 *
 * נכתב כסריקת תווים ולא ברגקס: מחלקות תווים עם escapes נשברו בפרויקט
 * הזה כמה פעמים, ושעה שגויה כאן משנה את הסטטוס שמוצג ללקוחות.
 */
export function toMinutes(value: string): number | null {
  const raw = String(value || "").trim();
  if (raw.length !== 5 || raw[2] !== ":") return null;

  let hours = 0;
  let minutes = 0;
  for (let index = 0; index < 5; index += 1) {
    if (index === 2) continue;
    const code = raw.charCodeAt(index);
    if (code < 48 || code > 57) return null;
    const digit = code - 48;
    if (index < 2) hours = hours * 10 + digit;
    else minutes = minutes * 10 + digit;
  }

  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** היום והשעה הנוכחיים בשעון העסק. */
export function nowInBusinessTime(reference: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(reference);

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const day = weekdays[lookup("weekday")] ?? 0;
  // "24" מוחזר בחלק מהסביבות בחצות; הוא שקול לאפס.
  const hour = Number(lookup("hour")) % 24;
  const minute = Number(lookup("minute"));

  return { day, minutes: hour * 60 + minute };
}

export type OpenState =
  | { state: "open"; closesAt: string }
  | { state: "closed"; opensDay: number; opensAt: string }
  | { state: "closed_today" }
  | { state: "unknown" };

/**
 * האם העסק פתוח כעת.
 *
 * "unknown" כשאין שעות מוגדרות — ואז אין להציג סטטוס כלל. הצגת "סגור"
 * לעסק שלא הגדיר שעות היא המצאה, בדיוק כמו הצגת "פתוח".
 */
export function openState(hours: OpeningHours[], reference: Date = new Date()): OpenState {
  const usable = hours.filter((entry) => entry && typeof entry.day === "number");
  if (!usable.length) return { state: "unknown" };

  const now = nowInBusinessTime(reference);
  const today = usable.find((entry) => entry.day === now.day);

  if (today && !today.closed) {
    // פתוח כל היממה: אין מה לחשב, ואין שעת סגירה להציג.
    if (today.allDay) return { state: "open", closesAt: "" };

    const from = toMinutes(today.open);
    const to = toMinutes(today.close);
    if (from !== null && to !== null && from <= now.minutes && now.minutes < to) {
      return { state: "open", closesAt: today.close };
    }
    // עוד לא נפתח היום.
    if (from !== null && now.minutes < from) {
      return { state: "closed", opensDay: now.day, opensAt: today.open };
    }
  }

  /*
   * הפתיחה הבאה: עוברים על שבעת הימים הבאים ועוצרים בראשון שפתוח.
   * בלי המעבר הזה, עסק שסגור בשבת היה מציג "סגור" בלי לומר מתי יחזור.
   */
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (now.day + offset) % 7;
    const entry = usable.find((item) => item.day === day);
    if (!entry || entry.closed) continue;
    if (entry.allDay) return { state: "closed", opensDay: day, opensAt: "00:00" };
    if (toMinutes(entry.open) === null) continue;
    return { state: "closed", opensDay: day, opensAt: entry.open };
  }

  // מוגדר, אך סגור בכל ימות השבוע.
  return { state: "closed_today" };
}

/** תיאור קצר של הסטטוס, לתג ולמקטע השעות. */
export function openStateLabel(state: OpenState): string {
  if (state.state === "open") return state.closesAt ? `פתוח · נסגר ב-${state.closesAt}` : "פתוח 24 שעות";
  if (state.state === "closed") return `סגור · נפתח ב${dayNames[state.opensDay]} ${state.opensAt}`;
  if (state.state === "closed_today") return "סגור";
  return "";
}

/**
 * כיווץ ימים רצופים בעלי אותן שעות לשורה אחת.
 *
 * שבע שורות זהות הן רעש. "ראשון–חמישי 09:00–18:00" נקרא מיד, וזו הדרך
 * שבה עסקים מציגים שעות בפועל.
 */
export function groupHours(hours: OpeningHours[]): Array<{ label: string; value: string; days: number[] }> {
  const byDay = [0, 1, 2, 3, 4, 5, 6]
    .map((day) => hours.find((entry) => entry.day === day))
    .filter(Boolean) as OpeningHours[];
  if (!byDay.length) return [];

  const signature = (entry: OpeningHours) =>
    entry.closed ? "closed" : entry.allDay ? "allday" : `${entry.open}-${entry.close}`;
  const groups: Array<{ days: number[]; entry: OpeningHours }> = [];

  for (const entry of byDay) {
    const last = groups[groups.length - 1];
    if (last && signature(last.entry) === signature(entry) && last.days[last.days.length - 1] === entry.day - 1) {
      last.days.push(entry.day);
    } else {
      groups.push({ days: [entry.day], entry });
    }
  }

  return groups.map((group) => ({
    days: group.days,
    label:
      group.days.length === 1
        ? dayNames[group.days[0]]
        : `${dayNames[group.days[0]]}–${dayNames[group.days[group.days.length - 1]]}`,
    value: group.entry.closed
      ? "סגור"
      : group.entry.allDay
        ? "פתוח 24 שעות"
        : `${group.entry.open}–${group.entry.close}`,
  }));
}
