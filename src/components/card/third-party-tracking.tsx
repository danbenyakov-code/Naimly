"use client";

import { useEffect } from "react";
import type { TrackingSettings } from "@/lib/types";

export function ThirdPartyTracking({ settings }: { settings: TrackingSettings }) {
  useEffect(() => {
    let loaded = false;
    const addExternal = (id: string, src: string) => { if (document.getElementById(id)) return; const script = document.createElement("script"); script.id = id; script.async = true; script.src = src; document.head.appendChild(script); };
    const addInline = (id: string, code: string) => { if (document.getElementById(id)) return; const script = document.createElement("script"); script.id = id; script.text = code; document.head.appendChild(script); };
    const load = () => {
      if (loaded || localStorage.getItem("cookie-consent") !== "accepted") return;
      loaded = true;
      if (/^G-[A-Z0-9]{4,20}$/i.test(settings.googleAnalyticsId)) {
        addExternal("naimly-ga-src", `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`);
        addInline("naimly-ga", `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${settings.googleAnalyticsId}',{anonymize_ip:true});`);
      }
      if (/^GTM-[A-Z0-9]{4,20}$/i.test(settings.googleTagManagerId)) {
        addExternal("naimly-gtm", `https://www.googletagmanager.com/gtm.js?id=${settings.googleTagManagerId}`);
      }
      if (/^\d{5,25}$/.test(settings.metaPixelId)) {
        addInline("naimly-meta-pixel", `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.metaPixelId}');fbq('track','PageView');`);
      }
    };
    load();
    const listener = (event: Event) => { if ((event as CustomEvent<string>).detail === "accepted") load(); };
    window.addEventListener("cookie-consent", listener);
    return () => window.removeEventListener("cookie-consent", listener);
  }, [settings.googleAnalyticsId, settings.googleTagManagerId, settings.metaPixelId]);
  return null;
}
