import type { ReactNode } from "react";

/**
 * מעטפת אחידה למקטע בכרטיס.
 *
 * עד כה כל מקטע חזר על אותה כותרת ואותם רווחים בשורה נפרדת, ושינוי
 * במרווח חייב עריכה בשמונה מקומות. כאן זה מקום אחד.
 *
 * העיקרון שמנחה את הרכיב: **מקטע בלי תוכן אינו מוצג**. כותרת מעל
 * ריק היא הבטחה שנשברת בכרטיס שהלקוח משלם עליו.
 */
export function SectionShell({
  title,
  children,
  /** כשאין תוכן — לא מרונדר דבר, כולל הכותרת. */
  hasContent = true,
  /** קו מפריד מעל, למקטעים שפותחים חלק חדש בכרטיס. */
  divided = false,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  hasContent?: boolean;
  divided?: boolean;
  className?: string;
}) {
  if (!hasContent) return null;

  return (
    <section className={`mt-7 ${divided ? "border-t border-[#e8ecf3] pt-6" : ""} ${className}`.trim()}>
      {title && <h3 className="text-base font-extrabold">{title}</h3>}
      {children}
    </section>
  );
}
