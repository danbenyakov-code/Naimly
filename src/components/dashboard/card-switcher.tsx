"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, Lock, Plus } from "lucide-react";
import type { CardSummary } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * מעבר בין הכרטיסים של החשבון והוספת כרטיס חדש (REQ-011).
 *
 * מוצג רק כשיש יותר מכרטיס אחד או כשהמסלול מאפשר להוסיף — אחרת זו
 * לשונית מיותרת שגוזלת מקום ומרמזת על יכולת שאינה קיימת.
 *
 * הכרטיס הנבחר נשמר ב-URL ולא ב-state: כך רענון, כפתור חזרה ושיתוף
 * קישור פנימי כולם מחזירים את אותו כרטיס.
 */
export function CardSwitcher({
  cards,
  activeId,
  maxCards,
  planName,
  canAdd,
  demo,
}: {
  cards: CardSummary[];
  activeId: string;
  maxCards: number;
  planName: string;
  canAdd: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const atLimit = cards.length >= maxCards;

  // כרטיס יחיד בלי אפשרות להוסיף — אין מה להחליף ואין מה להציע.
  if (cards.length <= 1 && !canAdd) return null;

  async function createCard() {
    if (demo) {
      setError("במצב הדגמה אי אפשר ליצור כרטיס נוסף.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/cards/new", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "לא הצלחנו ליצור כרטיס נוסף");
        return;
      }
      router.push(`/dashboard/card?card=${result.id}`);
      router.refresh();
    } catch {
      setError("אין חיבור לרשת. אפשר לנסות שוב.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-[#8b96a8]">הכרטיסים שלי</span>

        <div className="flex flex-wrap gap-2" role="group" aria-label="בחירת כרטיס לעריכה">
          {cards.map((card) => {
            const active = card.id === activeId;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={active}
                onClick={() => router.push(`/dashboard/card?card=${card.id}`)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
                  active ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] bg-white text-[#5f6d83] hover:border-[#a99feb]",
                )}
              >
                {active ? <Check size={15} aria-hidden="true" /> : <CreditCard size={15} aria-hidden="true" />}
                <span className="max-w-[160px] truncate">{card.businessName}</span>
                {/* סטטוס הפרסום גלוי בבורר: אחרת קל לערוך כרטיס שאינו באוויר ולא לשים לב. */}
                <span className={cn("rounded-full px-1.5 text-[10px] font-bold", card.isPublished ? "bg-[#e9fbf7] text-[#08735f]" : "bg-[#f1f3f7] text-[#7c8799]")}>
                  {card.isPublished ? "באוויר" : "טיוטה"}
                </span>
              </button>
            );
          })}
        </div>

        {atLimit ? (
          <span className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-[#d5cdf5] px-3 text-xs font-bold text-[#8b7fd4]">
            <Lock size={14} aria-hidden="true" />
            מסלול {planName} כולל עד {maxCards} {maxCards === 1 ? "כרטיס" : "כרטיסים"}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void createCard()}
            disabled={creating}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-[#c3b9f0] px-3 text-sm font-bold text-[#5a49c4] transition hover:border-[#6d4aff]"
          >
            {creating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            {creating ? "יוצרים…" : "כרטיס נוסף"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-[#a4243b]">
          {error}
        </p>
      )}
    </div>
  );
}
