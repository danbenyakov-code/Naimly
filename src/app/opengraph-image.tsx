import { ImageResponse } from "next/og";
import { brand } from "@/lib/config";

/**
 * תמונת השיתוף של האתר (QA-011).
 *
 * נוצרת בקוד ולא כקובץ סטטי, כדי שהמותג והטקסט יישארו מסונכרנים עם
 * config ולא יידרשו עריכה בכלי גרפי בכל שינוי.
 *
 * הגופן הוא ברירת המחדל של הסביבה: טעינת גופן עברי חיצוני מוסיפה תלות
 * רשת לכל בנייה, ותקלה בה הייתה מפילה את יצירת התמונה כולה.
 */
export const alt = `${brand.name} — ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0b1020 0%, #241a5c 55%, #6d4aff 100%)",
          color: "#ffffff",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 12, color: "#8ef3e4", fontWeight: 700 }}>
          {brand.name}
        </div>

        <div style={{ display: "flex", marginTop: 28, fontSize: 86, fontWeight: 900, lineHeight: 1.1 }}>
          {brand.tagline}
        </div>

        <div style={{ display: "flex", marginTop: 32, fontSize: 34, color: "#b6c1d3", lineHeight: 1.4 }}>
          כרטיס ביקור דיגיטלי עם QR, וואטסאפ ולידים
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 52,
            gap: 16,
            fontSize: 26,
            color: "#ffffff",
            background: "rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "16px 36px",
          }}
        >
          {brand.siteUrl.replace("https://", "")}
        </div>
      </div>
    ),
    size,
  );
}
