import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

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
  /**
   * מצב טעינה.
   *
   * שלד ולא ספינר: שלד שומר על הגובה ומונע קפיצה של התוכן שמתחת,
   * וזו הסיבה שהוא עדיף כשהמקטע כבר יודע כמה מקום הוא תופס.
   */
  loading = false,
  /** הודעת שגיאה. מוצגת במקום התוכן, בלי להפיל את שאר הכרטיס. */
  error = "",
  className = "",
}: {
  title?: string;
  children: ReactNode;
  hasContent?: boolean;
  divided?: boolean;
  loading?: boolean;
  error?: string;
  className?: string;
}) {
  const shell = `mt-7 ${divided ? "border-t border-[var(--card-line)] pt-6" : ""} ${className}`.trim();

  if (loading) {
    return (
      <section className={shell} aria-busy="true">
        {title && <h3 className="text-base font-extrabold">{title}</h3>}
        <div className="mt-3 grid gap-2" aria-hidden="true">
          <div className="h-4 w-1/3 animate-pulse rounded-md bg-[var(--card-surface-soft)]" />
          <div className="h-20 animate-pulse rounded-[var(--card-radius)] bg-[var(--card-surface-soft)]" />
        </div>
        <span className="sr-only">טוען…</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className={shell}>
        {title && <h3 className="text-base font-extrabold">{title}</h3>}
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[var(--card-radius)] bg-[var(--card-surface-soft)] p-3 text-sm leading-6 text-[#8a5a00]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      </section>
    );
  }

  if (!hasContent) return null;

  return (
    <section className={shell}>
      {title && <h3 className="text-base font-extrabold">{title}</h3>}
      {children}
    </section>
  );
}
