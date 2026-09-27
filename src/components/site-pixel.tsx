"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { siteMetaPixelId } from "@/lib/config";
import { reservedSlugs } from "@/lib/reserved-slugs";

/**
 * PageView במעברים בין עמודים.
 *
 * קוד הבסיס ב-<head> (meta-pixel.ts) שולח PageView רק בטעינה מלאה של
 * הדף. ב-Next מעבר בין עמודים אינו טוען את הדף מחדש, ובלי הרכיב הזה
 * Meta הייתה רואה רק את העמוד הראשון של כל ביקור.
 */
export function SitePixel() {
  const pathname = usePathname() || "/";
  /*
   * את העמוד הראשון כבר ספר קוד הבסיס, ולכן סופרים רק שינוי נתיב.
   * השוואה לנתיב האחרון ולא דגל "ריצה ראשונה" — Strict Mode מריץ אפקטים
   * פעמיים, ודגל היה נשרף בריצה הראשונה ושולח PageView כפול בשנייה.
   */
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    const segment = pathname.split("/")[1] || "";
    if (segment !== "" && !reservedSlugs.has(segment)) return;
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    // trackSingle — רק לפיקסל של NAIMLY, גם אם בלשונית נטען פיקסל של בעל כרטיס.
    fbq?.("trackSingle", siteMetaPixelId, "PageView");
  }, [pathname]);

  return null;
}
