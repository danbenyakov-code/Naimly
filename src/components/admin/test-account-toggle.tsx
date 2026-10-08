"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { setTestAccountAction } from "@/app/admin/users/actions";

/** כפתור סימון "חשבון בדיקה": מוציא את המשתמש מהסיכומים במסך הבקרה. */
export function TestAccountToggle({ userId, isTest }: { userId: string; isTest: boolean }) {
  const [value, setValue] = useState(isTest);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={value}
        onClick={() => startTransition(async () => {
          const result = await setTestAccountAction(userId, !value);
          if (result.ok) { setValue(!value); setError(""); } else setError(result.error || "לא הצלחנו לעדכן");
        })}
        className={`min-h-11 gap-2 px-4 text-sm ${value ? "button-primary" : "button-secondary"}`}
      >
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
        {value ? "חשבון בדיקה (לבטל סימון)" : "סימון כחשבון בדיקה"}
      </button>
      {error && <span role="alert" className="text-xs font-bold text-[#a32031]">{error}</span>}
    </span>
  );
}
