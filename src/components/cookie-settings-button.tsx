"use client";

import { Settings2 } from "lucide-react";

/**
 * פתיחת הגדרות העוגיות מדף המדיניות.
 *
 * קודם לכן הכפתור מחק את ההעדפה ורענן את העמוד — כלומר הבחירה הקיימת
 * נמחקה עוד לפני שהמשתמש בחר משהו אחר, ורענון היה מאבד את מקומו בדף.
 * עכשיו נפתחת החלונית עם הבחירה הנוכחית מסומנת, והמחיקה קורית רק
 * כשנשמרת בחירה חדשה.
 */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="button-secondary mt-3 min-h-11"
      onClick={() => window.dispatchEvent(new CustomEvent("naimly-consent-reopen"))}
    >
      <Settings2 size={16} aria-hidden="true" />
      פתיחת הגדרות עוגיות
    </button>
  );
}
