"use client";

import { useId } from "react";
import { AlertCircle, AlertTriangle, Check, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * מערכת שדות טופס נגישה — מקור אחד לכל הטפסים במערכת.
 *
 * עקרונות:
 *  - לייבל קבוע וגלוי תמיד, מקושר ל-input ב-htmlFor/id. Placeholder הוא דוגמה
 *    בלבד ולעולם לא מחליף לייבל.
 *  - חובה/אופציונלי מסומן בטקסט, לא בצבע בלבד, וזמין גם ל-aria.
 *  - טקסט עזר ושגיאה מקושרים ב-aria-describedby.
 *  - שגיאה חוסמת מוכרזת ב-role="alert", ומסומנת ב-aria-invalid.
 */

export type FieldRenderProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean;
  "aria-required": boolean;
  required: boolean;
};

export function Field({
  label,
  hint,
  error,
  warning,
  success,
  required = false,
  optional = false,
  /** מספר תווים נוכחי ומקסימלי — מציג מונה לפני שחורגים מהמגבלה. */
  count,
  maxLength,
  /** מצב בדיקה אסינכרונית (זמינות כתובת, למשל). */
  checking = false,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  required?: boolean;
  optional?: boolean;
  count?: number;
  maxLength?: number;
  checking?: boolean;
  children: (props: FieldRenderProps) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;

  const describedBy = [
    hint ? hintId : "",
    error ? errorId : "",
    warning || success || checking ? statusId : "",
  ].filter(Boolean).join(" ") || undefined;

  const nearLimit = typeof count === "number" && typeof maxLength === "number" && count > maxLength * 0.8;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.9rem] font-semibold text-[#0b1020]">
          {label}
          {required && <span className="required-field">חובה</span>}
          {optional && <span className="mr-1.5 text-xs font-normal text-[#8b96a8]">אופציונלי</span>}
        </label>

        {typeof count === "number" && typeof maxLength === "number" && (
          <span
            className={cn("shrink-0 text-xs tabular-nums", nearLimit ? "font-bold text-[#8a5300]" : "text-[#8b96a8]")}
            aria-live="polite"
          >
            {count}/{maxLength}
          </span>
        )}
      </div>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required,
        required,
      })}

      {hint && !error && <p id={hintId} className="text-xs leading-5 text-[#78859a]">{hint}</p>}

      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-semibold leading-5 text-[#a32031]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!error && (warning || success || checking) && (
        <p id={statusId} className="flex items-start gap-1.5 text-xs font-semibold leading-5" aria-live="polite">
          {checking ? (
            <>
              <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-[#68758a]" aria-hidden="true" />
              <span className="text-[#68758a]">בודקים...</span>
            </>
          ) : warning ? (
            <>
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#8a5300]" aria-hidden="true" />
              <span className="text-[#8a5300]">{warning}</span>
            </>
          ) : (
            <>
              <Check size={14} className="mt-0.5 shrink-0 text-[#08735f]" aria-hidden="true" />
              <span className="text-[#08735f]">{success}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** מחלקת קלט שמשתנה לפי מצב — לא נשענת על צבע בלבד (יש גם אייקון וטקסט). */
export function inputClass(hasError: boolean, base = "field-input") {
  return cn(base, hasError && "border-[#c93445] bg-[#fffafb] focus:border-[#c93445] focus:shadow-[0_0_0_4px_rgba(201,52,69,.12)]");
}

// ─────────────────────────────────────────────────────────────────────────────
// הודעות ברמת הטופס
// ─────────────────────────────────────────────────────────────────────────────

export type AlertTone = "error" | "warning" | "info" | "success";

const toneStyles: Record<AlertTone, { wrap: string; text: string; icon: React.ReactNode; role: "alert" | "status"; label: string }> = {
  error: {
    wrap: "border-[#f0bdc3] bg-[#fff2f4]",
    text: "text-[#a32031]",
    icon: <AlertCircle size={17} aria-hidden="true" />,
    role: "alert",
    label: "שגיאה",
  },
  warning: {
    wrap: "border-[#f1c9a0] bg-[#fff8ef]",
    text: "text-[#8a4d00]",
    icon: <AlertTriangle size={17} aria-hidden="true" />,
    role: "alert",
    label: "אזהרה",
  },
  info: {
    wrap: "border-[#bcd4f5] bg-[#f2f7ff]",
    text: "text-[#1d4e89]",
    icon: <Info size={17} aria-hidden="true" />,
    role: "status",
    label: "מידע",
  },
  success: {
    wrap: "border-[#b7e6d8] bg-[#effcf8]",
    text: "text-[#08735f]",
    icon: <Check size={17} aria-hidden="true" />,
    role: "status",
    label: "הצלחה",
  },
};

/**
 * הודעה ברמת הטופס. ארבעה מצבים נבדלים באייקון, בכותרת הנסתרת ובטקסט —
 * ולא בצבע בלבד.
 */
export function FormAlert({
  tone = "info",
  title,
  children,
  retryAfterSeconds,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  retryAfterSeconds?: number;
  className?: string;
}) {
  const style = toneStyles[tone];
  return (
    <div role={style.role} className={cn("rounded-2xl border p-3.5", style.wrap, className)}>
      <div className={cn("flex items-start gap-2", style.text)}>
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 text-sm leading-6">
          <span className="sr-only">{style.label}: </span>
          {title && <strong className="block">{title}</strong>}
          <div className={cn(title && "mt-0.5 font-normal")}>{children}</div>
          {typeof retryAfterSeconds === "number" && retryAfterSeconds > 0 && (
            <p className="mt-1 text-xs opacity-80">אפשר לנסות שוב בעוד {Math.ceil(retryAfterSeconds / 60)} דקות.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * סיכום שגיאות בראש הטופס. כל שורה היא קישור שמעביר מיקוד לשדה הבעייתי.
 * מקבל מיקוד אחרי הגשה כושלת, כדי שמשתמשי מקלדת וקורא מסך יגיעו ישר לתיקון.
 */
export function ErrorSummary({
  errors,
  fieldOrder,
  title,
}: {
  errors: Record<string, string>;
  fieldOrder?: string[];
  title?: string;
}) {
  const keys = fieldOrder ? fieldOrder.filter((key) => errors[key]) : Object.keys(errors);
  if (!keys.length) return null;

  const heading = title
    || (keys.length === 1 ? "יש לתקן שדה אחד כדי להמשיך:" : `יש לתקן ${keys.length} שדות כדי להמשיך:`);

  return (
    <div
      role="alert"
      tabIndex={-1}
      data-error-summary
      className="rounded-2xl border border-[#f0bdc3] bg-[#fff2f4] p-4 outline-none focus-visible:shadow-[0_0_0_3px_rgba(201,52,69,.25)]"
    >
      <p className="flex items-center gap-2 font-bold text-[#a32031]">
        <AlertCircle size={17} aria-hidden="true" />
        {heading}
      </p>
      <ul className="mt-2 grid gap-1.5">
        {keys.map((key) => (
          <li key={key} className="text-sm leading-6">
            <a
              href={`#field-${key}`}
              onClick={(event) => {
                event.preventDefault();
                const target = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
                target?.focus();
                target?.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
              className="text-[#a2434f] underline underline-offset-2 hover:text-[#a32031]"
            >
              {errors[key]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ממקד את סיכום השגיאות אחרי הגשה כושלת. */
export function focusErrorSummary(container?: HTMLElement | null) {
  const target = (container || document).querySelector<HTMLElement>("[data-error-summary]");
  target?.focus();
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
}
