"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * אירועי המרה של Meta Pixel, לפי סימן שהשרת משאיר בכתובת אחרי פעולה
 * שהצליחה במסד — לא לפי לחיצה על כפתור, שיכולה להיכשל אחריה.
 *
 * StartTrial: startTrialAction מפנה ל-/dashboard?trial=started רק אחרי
 * ש-select_trial_plan הצליח. זה "הדף החדש" שבהוראות של Meta.
 *
 * הסימן נמחק מהכתובת מיד אחרי השליחה, כדי שרענון או חזרה לדף לא יספרו
 * את אותה התנסות פעמיים. Strict Mode מריץ את האפקט פעמיים — בריצה השנייה
 * הסימן כבר לא קיים, ולכן גם שם נשלח אירוע אחד בלבד.
 */
const conversions: Array<{ param: string; value: string; event: string; data?: Record<string, unknown> }> = [
  { param: "trial", value: "started", event: "StartTrial", data: { value: 0, currency: "ILS" } },
];

export function MetaConversions() {
  // redirect מ-server action הוא ניווט בתוך האפליקציה ולא טעינת דף, ולכן
  // האפקט רץ מחדש בכל שינוי נתיב ולא רק בטעינה הראשונה.
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    let changed = false;

    for (const conversion of conversions) {
      if (url.searchParams.get(conversion.param) !== conversion.value) continue;
      fbq?.("track", conversion.event, conversion.data);
      url.searchParams.delete(conversion.param);
      changed = true;
    }

    if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [pathname]);

  return null;
}
