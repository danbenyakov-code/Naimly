import type { NextConfig } from "next";

// מקורות חיצוניים שהמערכת באמת טוענת: מדידה (רק אחרי אישור עוגיות),
// נגן YouTube מוטמע, ותמונות/קבצים מאחסון Supabase.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

const analyticsHosts = ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://connect.facebook.net"];

// Turbopack ב‑dev מייצר קוד שמצריך eval וחיבור HMR. שני ההיתרים האלה
// אינם נכללים בבניית פרודקשן.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // הסקריפטים של GA/GTM/Pixel מוזרקים בצד הלקוח ולכן נדרש unsafe-inline.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${analyticsHosts.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://www.google-analytics.com https://www.facebook.com ${supabaseHost}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} ${supabaseHost.replace("https://", "wss://")} https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com${isDev ? " ws: http://localhost:*" : ""}`.trim(),
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' blob: " + supabaseHost,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
]
  .map((directive) => directive.replace(/\s+/g, " ").trim())
  .join("; ");

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
