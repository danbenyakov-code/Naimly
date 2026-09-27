import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/csp";

// מקורות חיצוניים שהמערכת באמת טוענת: מדידה (רק אחרי אישור עוגיות),
// נגן YouTube מוטמע, ותמונות/קבצים מאחסון Supabase.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

// המדיניות והאינטגרציות שהיא מתירה מתועדות ב-src/lib/csp.ts.
const contentSecurityPolicy = buildContentSecurityPolicy({
  supabaseOrigin: supabaseHost,
  // Turbopack ב-dev מייצר קוד שמצריך eval וחיבור HMR; לא בפרודקשן.
  isDev: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // תשובות שתלויות בזהות המשתמש לא נשמרות במטמון משותף.
        // /api/vcard מוחרג בכוונה — הוא תוכן ציבורי שמותר ל‑CDN לשמור.
        source: "/api/:path((?!vcard).*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/dashboard/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
