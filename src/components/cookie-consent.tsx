"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(!localStorage.getItem("cookie-consent")));
    return () => cancelAnimationFrame(frame);
  }, []);
  function choose(value: "accepted" | "rejected") {
    localStorage.setItem("cookie-consent", value);
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: value }));
    setVisible(false);
  }
  if (!visible) return null;
  return <aside className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-[#d7deea] bg-white p-4 shadow-[0_18px_60px_rgba(11,24,48,.22)] sm:flex sm:items-center sm:gap-5" aria-label="העדפות פרטיות"><p className="flex-1 text-sm leading-6 text-[#5f6d83]"><strong className="text-[#142038]">הפרטיות שלך חשובה לנו.</strong> אחסון הכרחי משמש להפעלת האתר. כלי מדידה ושיווק נטענים רק לאחר אישור. מידע נוסף ב<Link href="/legal/cookies" className="font-bold text-[#6d4aff]">מדיניות העוגיות</Link>.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex"><button type="button" className="button-secondary min-h-10 px-4 py-1 text-sm" onClick={() => choose("rejected")}>רק הכרחי</button><button type="button" className="button-primary min-h-10 px-4 py-1 text-sm" onClick={() => choose("accepted")}>אישור מדידה</button></div></aside>;
}
