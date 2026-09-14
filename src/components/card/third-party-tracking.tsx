"use client";

import { useEffect } from "react";
import type { TrackingSettings } from "@/lib/types";
import { CONSENT_EVENT, hasConsent, type ConsentState } from "@/lib/consent";

/**
 * טעינת כלי צד שלישי לפי ההסכמה שניתנה.
 *
 * REQ-004: אנליטיקה ושיווק נטענים בנפרד. קודם לכן פיקסל שיווקי נטען על
 * סמך הסכמה למדידה — שתי מטרות שונות תחת לחיצה אחת, וזו בדיוק ההפרדה
 * שרשויות הגנת הפרטיות דורשות.
 *
 * הטעינה מתרחשת רק אחרי הסכמה, לעולם לא לפניה: סקריפט שנטען ואז "כובה"
 * כבר שלח בקשה ויצר מזהה.
 */
export function ThirdPartyTracking({ settings }: { settings: TrackingSettings }) {
  useEffect(() => {
    let analyticsLoaded = false;
    let marketingLoaded = false;

    const addExternal = (id: string, src: string) => {
      if (document.getElementById(id)) return;
      const script = document.createElement("script");
      script.id = id;
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    };

    const addInline = (id: string, code: string) => {
      if (document.getElementById(id)) return;
      const script = document.createElement("script");
      script.id = id;
      script.text = code;
      document.head.appendChild(script);
    };

    const loadAnalytics = () => {
      if (/^G-[A-Z0-9]{4,20}$/i.test(settings.googleAnalyticsId)) {
        addExternal("naimly-ga-src", `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`);
        addInline(
          "naimly-ga",
          `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${settings.googleAnalyticsId}',{anonymize_ip:true});`,
        );
      }
      if (/^GTM-[A-Z0-9]{4,20}$/i.test(settings.googleTagManagerId)) {
        addExternal("naimly-gtm", `https://www.googletagmanager.com/gtm.js?id=${settings.googleTagManagerId}`);
      }
    };

    const loadMarketing = () => {
      if (/^[0-9]{5,25}$/.test(settings.metaPixelId)) {
        addInline(
          "naimly-meta-pixel",
          `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.metaPixelId}');fbq('track','PageView');`,
        );
      }
    };

    const load = () => {
      if (!analyticsLoaded && hasConsent("analytics")) {
        analyticsLoaded = true;
        loadAnalytics();
      }
      if (!marketingLoaded && hasConsent("marketing")) {
        marketingLoaded = true;
        loadMarketing();
      }
    };

    load();
    const listener = (event: Event) => {
      if ((event as CustomEvent<ConsentState>).detail) load();
    };
    window.addEventListener(CONSENT_EVENT, listener);
    return () => window.removeEventListener(CONSENT_EVENT, listener);
  }, [settings.googleAnalyticsId, settings.googleTagManagerId, settings.metaPixelId]);

  return null;
}
