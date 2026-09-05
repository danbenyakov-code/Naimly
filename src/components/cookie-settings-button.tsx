"use client";

export function CookieSettingsButton() {
  return <button type="button" className="button-secondary mt-3" onClick={() => { localStorage.removeItem("cookie-consent"); location.reload(); }}>פתיחת הגדרות עוגיות</button>;
}
