"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { siteMetaPixelId } from "@/lib/config";
import { CONSENT_EVENT, hasConsent, type ConsentState } from "@/lib/consent";
import { reservedSlugs } from "@/lib/reserved-slugs";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };

/**
 * Meta Pixel של NAIMLY — בעמודי האתר בלבד, ורק אחרי הסכמה לשיווק.
 *
 * לא בכרטיסי הלקוחות: שם נטען הפיקסל של בעל הכרטיס (ThirdPartyTracking).
 * fbq('track') שולח לכל פיקסל שאותחל בדף, ולכן שני פיקסלים יחד היו
 * שולחים את המבקרים של הלקוח ל-NAIMLY — ואת שלנו אליו.
 *
 * עמוד "של האתר" מזוהה לפי המקטע הראשון בנתיב: דף הבית או נתיב שמור
 * (reservedSlugs) — אותה רשימה שאוסרת על כרטיס לתפוס את הכתובות האלה.
 */
function isSitePage(pathname: string) {
  const first = pathname.split("/")[1] || "";
  return first === "" || reservedSlugs.has(first);
}

function loadPixel(id: string) {
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (!w.fbq) {
    // קוד הבסיס של Meta, בלי ה-PageView — אותו שולחים לפי ניווט.
    const fbq: Fbq = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    };
    fbq.queue = [];
    Object.assign(fbq, { push: fbq, loaded: true, version: "2.0" });
    w.fbq = fbq;
    if (!w._fbq) w._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  w.fbq!("init", id);
}

export function SitePixel() {
  const pathname = usePathname() || "/";
  const [allowed, setAllowed] = useState(false);
  // ref ולא state: עדכון state היה מריץ את האפקט שוב ושולח PageView כפול.
  const loaded = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAllowed(hasConsent("marketing")));
    const listener = (event: Event) => setAllowed((event as CustomEvent<ConsentState>).detail?.marketing === true);
    window.addEventListener(CONSENT_EVENT, listener);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(CONSENT_EVENT, listener);
    };
  }, []);

  useEffect(() => {
    if (!allowed || !siteMetaPixelId || !isSitePage(pathname)) return;
    if (!loaded.current) {
      loadPixel(siteMetaPixelId);
      loaded.current = true;
    }
    /*
     * PageView לכל ניווט, כי ב-Next המעבר בין עמודים אינו טוען את הדף
     * מחדש. trackSingle ולא track — כדי שהאירוע יגיע רק לפיקסל שלנו גם
     * אם בהמשך אותה לשונית נטען פיקסל של בעל כרטיס.
     */
    (window as unknown as { fbq: Fbq }).fbq("trackSingle", siteMetaPixelId, "PageView");
  }, [allowed, pathname]);

  return null;
}
