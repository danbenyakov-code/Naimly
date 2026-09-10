"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth-schema";

/**
 * שליחה חוזרת של קוד, עם השהיה שמונעת הצפה.
 * הזמן הנותר מוצג בטקסט ולא רק בכפתור מושבת, כדי שיהיה ברור למה אי אפשר ללחוץ.
 * ההשהיה מתחילה מהלחיצה עצמה — לא מתוך effect.
 */
export function ResendButton({
  action,
  email,
  pending,
  className = "flex-1",
}: {
  action: (formData: FormData) => void;
  email: string;
  pending: boolean;
  className?: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const blocked = secondsLeft > 0 || pending;

  return (
    <form action={action} className={className}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={blocked}
        onClick={() => setSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS)}
        className="button-secondary min-h-12 w-full"
        aria-busy={pending}
      >
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
        {pending ? "שולחים..." : secondsLeft > 0 ? `שליחת קוד חדש בעוד ${secondsLeft} שניות` : "שליחת קוד חדש"}
      </button>
    </form>
  );
}
