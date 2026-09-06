"use client";

import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { evaluatePassword, passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

const barColors = ["bg-[#d94b5e]", "bg-[#d94b5e]", "bg-[#e0932f]", "bg-[#3fa06b]", "bg-[#0a9b81]"];
const textColors = ["text-[#a32031]", "text-[#a32031]", "text-[#8a5300]", "text-[#0b6b4a]", "text-[#08735f]"];

/**
 * שדה סיסמה עם חיווי חוזק ורשימת דרישות חיה.
 * החיווי נגיש: הוא לא נשען על צבע בלבד — יש טקסט, אייקון וכן/לא לכל דרישה,
 * והמצב מוכרז ב-aria-live כדי שקורא מסך ישמע את השינוי.
 */
export function PasswordField({
  name,
  label = "סיסמה",
  value,
  onChange,
  error,
  autoComplete = "new-password",
  showMeter = true,
  hint,
}: {
  name: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  showMeter?: boolean;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => evaluatePassword(value), [value]);

  return (
    <div className="grid gap-2">
      <Field label={label} required error={error} hint={hint}>
        {(field) => (
          <div className="relative">
            <input
              {...field}
              name={name}
              type={visible ? "text" : "password"}
              className={cn(inputClass(Boolean(error)), "pl-12")}
              autoComplete={autoComplete}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="absolute left-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-[#68758a] hover:bg-[#f2f4f8]"
              aria-label={visible ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        )}
      </Field>

      {showMeter && value.length > 0 && (
        <div className="rounded-2xl border border-[#e4e8f0] bg-[#fbfcfe] p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#68758a]">חוזק הסיסמה</span>
            <span className={cn("text-xs font-bold", textColors[strength.score])} aria-live="polite">
              {strength.label}
            </span>
          </div>

          <div className="mt-2 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", index < strength.score ? barColors[strength.score] : "bg-[#e4e8f0]")}
              />
            ))}
          </div>

          <ul className="mt-3 grid gap-1">
            {passwordRules.map((rule) => {
              const met = rule.test(value);
              return (
                <li key={rule.id} className={cn("flex items-center gap-1.5 text-xs", met ? "text-[#08735f]" : "text-[#78859a]")}>
                  {met
                    ? <Check size={13} className="shrink-0" aria-hidden="true" />
                    : <X size={13} className="shrink-0" aria-hidden="true" />}
                  <span>{rule.label}</span>
                  <span className="sr-only">{met ? "— תקין" : "— חסר"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
