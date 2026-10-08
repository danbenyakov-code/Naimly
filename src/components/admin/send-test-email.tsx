"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { sendTestEmailAction } from "@/app/admin/emails/actions";
import type { PreviewId } from "@/emails/previews";

export function SendTestEmail({ id }: { id: PreviewId }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await sendTestEmailAction(id);
          setMessage({ ok: result.ok, text: result.message });
        })}
        className="button-secondary min-h-10 gap-2 px-3 text-xs"
      >
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
        שליחת מייל בדיקה אליי
      </button>
      {message && <span role="status" className={`text-xs font-bold ${message.ok ? "text-[#08735f]" : "text-[#a32031]"}`}>{message.text}</span>}
    </div>
  );
}
