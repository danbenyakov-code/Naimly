"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, Sparkles } from "lucide-react";
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

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * ספירה לאחור של ההתנסות, בפורמט `ימים | HH : MM : SS`.
 *
 * מקור האמת לתפוגה הוא השרת (`trial_ends_at`). השעון בדפדפן משמש לתצוגה
 * בלבד — הרשאות לעולם אינן נגזרות ממנו.
 *
 * הכרזה לקורא מסך נעשית ברמת יום ולא כל שנייה, כדי לא להציף אותו.
 */
export function TrialTimer({ endsAt, variant = "banner" }: { endsAt: string | null; variant?: "banner" | "compact" }) {
  const tick = useSyncExternalStore(subscribeToSecond, secondSnapshot, serverSnapshot);
  // tick === 0 פירושו רינדור בשרת: מציגים placeholder ולא זמן שיסתור את הלקוח.
  const now = useMemo(() => (tick === 0 ? null : remaining(endsAt)), [tick, endsAt]);
  const urgent = Boolean(now && !now.expired && now.days < 3);

  if (!endsAt) return null;

  // ההודעה לקורא מסך מתעדכנת רק כשמספר הימים משתנה.
  const spokenStatus = now
    ? now.expired
      ? "תקופת ההתנסות הסתיימה"
      : `נותרו ${now.days} ימים בתקופת ההתנסות`
    : "";

  const clock = (
    <span className="flex items-center gap-1.5 font-mono tabular-nums" dir="ltr" suppressHydrationWarning>
      {now && !now.expired ? (
        <>
          <span className="font-black">{now.days}</span>
          <span className="opacity-45">|</span>
          <span>{pad(now.hours)}</span>
          <span className="opacity-45">:</span>
          <span>{pad(now.minutes)}</span>
          <span className="opacity-45">:</span>
          <span>{pad(now.seconds)}</span>
        </>
      ) : now?.expired ? (
        <>
          <span className="font-black">0</span>
          <span className="opacity-45">|</span>
          <span>00</span><span className="opacity-45">:</span>
          <span>00</span><span className="opacity-45">:</span>
          <span>00</span>
        </>
      ) : (
        <span className="opacity-45">— | --:--:--</span>
      )}
    </span>
  );

  if (variant === "compact") {
    return (
      <div className="rounded-xl bg-white/10 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#74e5d5]">
          <Clock size={13} aria-hidden="true" />
          {now?.expired ? "ההתנסות הסתיימה" : "נותר בהתנסות"}
        </div>

        <div className="mt-1.5 text-base text-white">{clock}</div>
        <div className="mt-0.5 flex gap-1.5 text-[11px] uppercase tracking-wide text-white/50" dir="ltr" aria-hidden="true">
          <span className="w-5 text-center">יום</span>
          <span className="w-2" />
          <span className="w-6 text-center">שע׳</span>
          <span className="w-1.5" />
          <span className="w-6 text-center">דק׳</span>
          <span className="w-1.5" />
          <span className="w-6 text-center">שנ׳</span>
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#74e5d5] transition-[width] duration-1000" style={{ width: `${now?.percentUsed ?? 0}%` }} />
        </div>
        <p className="sr-only" aria-live="polite">{spokenStatus}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        now?.expired
          ? "border-[#f0b8c0] bg-[#fff2f4] text-[#8d1f2e]"
          : urgent
            ? "border-[#f1d69a] bg-[#fff8e8] text-[#805100]"
            : "border-[#d8d0ff] bg-[#f3f0ff] text-[#4636a6]",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {now?.expired ? <AlertTriangle size={19} /> : <Sparkles size={19} />}
        </span>
        <div className="min-w-0">
          <strong className="block">
            {now?.expired ? `תקופת ההתנסות בת ${TRIAL_DAYS} הימים הסתיימה` : `תקופת התנסות — ${TRIAL_DAYS} ימים`}
          </strong>
          <p className="mt-0.5 text-sm leading-6">
            {now?.expired
              ? "הכרטיס הציבורי הושהה ושמירת שינויים חסומה. בחירת מסלול מחזירה הכול לאוויר מיד."
              : "כל מה שבנית נשמר. בחירת מסלול לפני סיום ההתנסות שומרת על הכרטיס פעיל ברצף."}
          </p>

          {/* שעון ספרתי */}
          <div className="mt-3 inline-flex flex-col rounded-xl bg-white/70 px-3 py-2">
            <div className="text-lg sm:text-xl">{clock}</div>
            <div className="mt-1 flex gap-1.5 text-[11px] font-bold tracking-wide opacity-60" dir="ltr" aria-hidden="true">
              <span className="w-6 text-center">ימים</span>
              <span className="w-2" />
              <span className="w-7 text-center">שעות</span>
              <span className="w-1.5" />
              <span className="w-7 text-center">דקות</span>
              <span className="w-1.5" />
              <span className="w-7 text-center">שנ׳</span>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">{spokenStatus}</p>
        </div>
      </div>

      <Link href="/pricing" className="button-primary min-h-12 w-full shrink-0 sm:w-auto">
        {now?.expired ? "הפעלת מסלול" : "בחירת מסלול"}
        <ArrowLeft size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
