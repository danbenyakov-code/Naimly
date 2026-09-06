"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * קלט קוד בן 6 ספרות. שישה תיבות לתצוגה, ושדה נסתר אחד שנשלח בטופס —
 * כך ההדבקה, החיצים ו-autocomplete של קוד ה-SMS/מייל עובדים כמצופה,
 * ובלי לפצל את הערך למי שמשתמש בקורא מסך.
 */
export function OtpInput({ name, error, disabled = false, length = 6 }: { name: string; error?: string; disabled?: boolean; length?: number }) {
  const id = useId();
  const errorId = `${id}-error`;
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const value = digits.join("");

  function setAt(index: number, next: string) {
    setDigits((current) => {
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) { setAt(index, ""); return; }

    if (clean.length > 1) {
      // הדבקה של הקוד המלא
      const chars = clean.slice(0, length).split("");
      setDigits((current) => {
        const copy = [...current];
        chars.forEach((char, offset) => { if (index + offset < length) copy[index + offset] = char; });
        return copy;
      });
      refs.current[Math.min(index + chars.length, length - 1)]?.focus();
      return;
    }

    setAt(index, clean);
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setAt(index - 1, "");
      event.preventDefault();
    }
    if (event.key === "ArrowRight" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index < length - 1) refs.current[index + 1]?.focus();
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={`${id}-0`} className="text-[0.9rem] font-semibold">
        קוד אימות<span className="required-field">חובה</span>
      </label>

      <input type="hidden" name={name} value={value} />

      {/* dir=ltr כדי שהספרות יוקלדו משמאל לימין כמו שהקוד נראה במייל */}
      <div dir="ltr" className="flex justify-center gap-2" role="group" aria-labelledby={`${id}-label`}>
        {digits.map((digit, index) => (
          <input
            key={index}
            id={`${id}-${index}`}
            ref={(element) => { refs.current[index] = element; }}
            className={cn(
              "h-14 w-11 rounded-xl border text-center text-xl font-black tabular-nums outline-none transition sm:h-16 sm:w-13",
              error ? "border-[#d3697a] bg-[#fffafb]" : "border-[#cfd7e5] bg-white focus:border-[#6d4aff] focus:shadow-[0_0_0_4px_rgba(109,74,255,.11)]",
            )}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            value={digit}
            disabled={disabled}
            aria-label={`ספרה ${index + 1} מתוך ${length}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>

      {error && (
        <p id={errorId} role="alert" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#a32031]">
          <AlertCircle size={14} aria-hidden="true" />{error}
        </p>
      )}
    </div>
  );
}
