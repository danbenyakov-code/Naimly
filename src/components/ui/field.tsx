"use client";

import { useId } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * שדה טופס נגיש. מקשר בין התווית, הסבר העזר והשגיאה בעזרת aria-describedby,
 * מסמן aria-invalid, ומכריז על השגיאה עם role="alert" כדי שקורא מסך ישמע אותה
 * ברגע שהיא מופיעה. כל שדה חובה מסומן גם ויזואלית וגם ל-aria.
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
  success,
  required = false,
  optional = false,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  optional?: boolean;
  children: (props: FieldRenderProps) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.9rem] font-semibold text-[#0b1020]">
        {label}
        {required && <span className="required-field">חובה</span>}
        {optional && <span className="mr-1.5 text-xs font-normal text-[#8b96a8]">(לא חובה)</span>}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required,
        required,
      })}

      {hint && !error && (
        <p id={hintId} className="text-xs leading-5 text-[#78859a]">{hint}</p>
      )}

      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-semibold leading-5 text-[#a32031]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="flex items-start gap-1.5 text-xs font-semibold leading-5 text-[#08735f]">
          <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {success}
        </p>
      )}
    </div>
  );
}

/** מחלקת קלט שמשתנה לפי מצב השגיאה, כדי שהמצב לא ייקרא רק לפי צבע. */
export function inputClass(hasError: boolean, base = "field-input") {
  return cn(base, hasError && "border-[#d3697a] bg-[#fffafb] focus:border-[#c93445] focus:shadow-[0_0_0_4px_rgba(201,52,69,.12)]");
}

/**
 * סיכום שגיאות בראש הטופס. מקבל מיקוד בעת הגשה כושלת כדי שמשתמשי מקלדת
 * וקורא מסך יגיעו ישירות למה שצריך לתקן, עם קישור לכל שדה.
 */
export function ErrorSummary({ errors, fieldOrder }: { errors: Record<string, string>; fieldOrder?: string[] }) {
  const keys = fieldOrder ? fieldOrder.filter((key) => errors[key]) : Object.keys(errors);
  if (!keys.length) return null;

  return (
    <div
      role="alert"
      tabIndex={-1}
      data-error-summary
      className="rounded-2xl border border-[#f0bdc3] bg-[#fff2f4] p-4 outline-none"
    >
      <p className="flex items-center gap-2 font-bold text-[#a32031]">
        <AlertCircle size={17} aria-hidden="true" />
        {keys.length === 1 ? "יש לתקן שדה אחד:" : `יש לתקן ${keys.length} שדות:`}
      </p>
      <ul className="mt-2 grid gap-1">
        {keys.map((key) => (
          <li key={key} className="text-sm leading-6 text-[#a2434f]">• {errors[key]}</li>
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
