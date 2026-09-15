"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { CONSENT_EVENT, hasConsent, type ConsentState } from "@/lib/consent";

/**
 * Vercel Web Analytics, מאחורי הסכמת המבקר.
 *
 * ה-PR המקורי הוסיף את `<Analytics />` ללא תנאי. מדיניות העוגיות שלנו
 * קובעת במפורש: "ללא אישור הקטגוריה הזו לא נאסף מידע מדידה כלל, גם לא
 * במדידה הפנימית של NAIMLY". טעינה ללא הסכמה הייתה מפרה את המדיניות
 * שאנחנו עצמנו מפרסמים — וזו סתירה גרועה יותר מהיעדר המדידה.
 *
 * Vercel Analytics אינו משתמש בעוגיות, אבל הוא עדיין מדידה. הקטגוריה
 * נקבעת לפי המטרה ולא לפי הטכנולוגיה.
 *
 * הרכיב אינו מרונדר כלל עד להסכמה — ולא "נטען ומכובה". סקריפט שנטען
 * כבר שלח בקשה, וכיבוי בדיעבד אינו מבטל אותה.
 */
export function ConsentedAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    /*
     * הבדיקה אחרי ההרכבה: localStorage אינו קיים בשרת.
     *
     * דרך requestAnimationFrame ולא קריאה ישירה — setState סינכרוני
     * בתוך אפקט מפעיל רינדור נוסף מיד, וזה בדיוק מה שהכלל של React
     * מזהיר מפניו.
     */
    const frame = requestAnimationFrame(() => setAllowed(hasConsent("analytics")));

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<ConsentState>).detail;
      setAllowed(detail?.analytics === true);
    };

    window.addEventListener(CONSENT_EVENT, listener);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(CONSENT_EVENT, listener);
    };
  }, []);

  if (!allowed) return null;
  return <Analytics />;
}
