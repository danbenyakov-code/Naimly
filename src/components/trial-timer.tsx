"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/plan-access";
import { cn } from "@/lib/utils";

function remaining(endsAt: string | null) {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return { expired: true as const, days: 0, hours: 0, minutes: 0, seconds: 0, percentUsed: 100 };
  const totalMs = TRIAL_DAYS * 86400000;
  return {
    expired: false as const,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
    percentUsed: Math.min(100, Math.max(0, Math.round(((totalMs - ms) / totalMs) * 100))),
  };
}

/** שעון חיצוני שמתקתק כל שנייה. השרת מקבל snapshot קבוע כדי למנוע אי‑התאמת hydration. */
function subscribeToSecond(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}
const secondSnapshot = () => Math.floor(Date.now() / 1000);
const serverSnapshot = () => 0;

/** ספירה לאחור חיה של 14 ימי ההתנסות. */
export function TrialTimer({ endsAt, variant = "banner" }: { endsAt: string | null; variant?: "banner" | "compact" }) {
  const tick = useSyncExternalStore(subscribeToSecond, secondSnapshot, serverSnapshot);
  // tick === 0 פירושו רינדור בשרת: אז מציגים placeholder ולא זמן שיסתור את הלקוח.
  const now = useMemo(() => (tick === 0 ? null : remaining(endsAt)), [tick, endsAt]);
  const urgent = useMemo(() => Boolean(now && !now.expired && now.days < 3), [now]);

  if (!endsAt) return null;

  if (variant === "compact") {
    return (
      <div className="rounded-xl bg-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#74e5d5]">
          <Clock size={13} />
          {now?.expired ? "ההתנסות הסתיימה" : "נותרו בהתנסות"}
        </div>
        <p className="mt-1 font-mono text-sm font-black tabular-nums text-white" dir="ltr" suppressHydrationWarning>
          {now ? (now.expired ? "00:00:00:00" : `${String(now.days).padStart(2, "0")}:${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")}`) : "--:--:--:--"}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#74e5d5] transition-[width] duration-1000" style={{ width: `${now?.percentUsed ?? 0}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between",
        now?.expired
          ? "border-[#f0b8c0] bg-[#fff2f4] text-[#8d1f2e]"
          : urgent
            ? "border-[#f1d69a] bg-[#fff8e8] text-[#805100]"
            : "border-[#d8d0ff] bg-[#f3f0ff] text-[#4636a6]",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{now?.expired ? <AlertTriangle size={19} /> : <Sparkles size={19} />}</span>
        <div>
          <strong className="block">
            {now?.expired ? `תקופת ההתנסות בת ${TRIAL_DAYS} הימים הסתיימה` : `תקופת התנסות — ${TRIAL_DAYS} ימים`}
          </strong>
          <p className="mt-0.5 leading-6">
            {now?.expired
              ? "הכרטיס הציבורי הושהה ושמירת שינויים חסומה. בחירת מסלול מחזירה הכול לאוויר מיד."
              : "כל מה שבנית נשמר. בחירת מסלול לפני סיום ההתנסות שומרת על הכרטיס פעיל ברצף."}
          </p>
          {!now?.expired && (
            <p className="mt-2 font-mono text-base font-black tabular-nums" dir="ltr" suppressHydrationWarning>
              {now ? `${now.days} ימים · ${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")}` : "…"}
            </p>
          )}
        </div>
      </div>
      <Link href="/pricing" className="button-primary shrink-0 whitespace-nowrap">
        {now?.expired ? "הפעלת מסלול" : "בחירת מסלול"}
      </Link>
    </div>
  );
}
