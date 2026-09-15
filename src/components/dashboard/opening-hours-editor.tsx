"use client";

import { useState } from "react";
import { Clock3, Copy } from "lucide-react";
import type { CardData } from "@/lib/types";
import {
  dayNames, dayNamesShort, defaultOpeningHours, openState, openStateLabel, type OpeningHours,
} from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/**
 * עריכת שעות פעילות.
 *
 * שורת ימים בראש — א׳ עד ש׳ — שמסמנת אילו ימים פתוחים במבט אחד, ומתחתיה
 * ההגדרה של היום הנבחר. כך מגדירים שעות בפועל: קודם בוחרים ימים, ורק
 * אחר כך שעות.
 *
 * לכל יום פתוח יש שתי אפשרויות: פתוח כל היממה, או טווח שעות. עסק שפתוח
 * 24/7 לא אמור למלא 00:00–23:59 ולקוות שזה ייראה נכון.
 *
 * הסטטוס שהלקוח יראה מוצג בראש, כדי שלא יהיה צורך לנחש אם ההגדרה יצאה
 * כמתוכנן.
 */
export function OpeningHoursEditor({
  card,
  onChange,
}: {
  card: CardData;
  onChange: (hours: OpeningHours[]) => void;
}) {
  const hours = card.openingHours || [];
  const [selected, setSelected] = useState(0);

  const state = openState(hours);
  const label = openStateLabel(state);

  function entryFor(day: number): OpeningHours {
    return hours.find((item) => item.day === day) || { day, closed: true, allDay: false, open: "09:00", close: "18:00" };
  }

  function patch(day: number, next: Partial<OpeningHours>) {
    const base = hours.length ? hours : defaultOpeningHours();
    onChange(base.map((entry) => (entry.day === day ? { ...entry, ...next } : entry)));
  }

  /** העתקת ההגדרה של היום הנבחר לכל שאר הימים הפתוחים. */
  function copyToOpenDays() {
    const source = entryFor(selected);
    onChange(
      hours.map((entry) =>
        entry.day === selected || entry.closed
          ? entry
          : { ...entry, allDay: source.allDay, open: source.open, close: source.close },
      ),
    );
  }

  if (!hours.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d5cdf5] p-5 text-center">
        <p className="text-sm leading-6 text-[#5f6d83]">
          עדיין לא הוגדרו שעות. כל עוד אין שעות, הכרטיס אינו מציג סטטוס — לא ״פתוח״ ולא ״סגור״.
        </p>
        <button type="button" className="button-secondary mt-3 min-h-11" onClick={() => onChange(defaultOpeningHours())}>
          <Clock3 size={16} aria-hidden="true" />
          הגדרת שעות פעילות
        </button>
      </div>
    );
  }

  const current = entryFor(selected);

  return (
    <div>
      {label && (
        <p className="mb-3 text-sm text-[#5f6d83]">
          כרגע מוצג בכרטיס: <strong className="font-extrabold text-[#4b3bad]">{label}</strong>
        </p>
      )}

      {/* שורת הימים — סימון מהיר של מה פתוח ומה סגור. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="ימי הפעילות">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const entry = entryFor(day);
          const active = selected === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(day)}
              aria-pressed={active}
              aria-label={`${dayNames[day]} — ${entry.closed ? "סגור" : "פתוח"}`}
              className={cn(
                "grid h-12 w-12 place-items-center rounded-xl border text-sm font-extrabold transition",
                active ? "border-[#6d4aff] ring-2 ring-[#6d4aff]/25" : "border-[#dfe4ec]",
                entry.closed ? "bg-[#f4f5f8] text-[#9aa4b4]" : "bg-[#f1efff] text-[#4b3bad]",
              )}
            >
              {dayNamesShort[day]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-[#e2e6ee] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-sm">יום {dayNames[selected]}</strong>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#6d4aff]"
              checked={!current.closed}
              onChange={(event) => patch(selected, { closed: !event.target.checked })}
            />
            פתוח ביום זה
          </label>
        </div>

        {!current.closed && (
          <>
            {/* שתי אפשרויות בלבד, כי אלה המצבים שקיימים בפועל. */}
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="אופן הפעילות">
              {([
                [false, "טווח שעות"],
                [true, "פתוח 24 שעות"],
              ] as const).map(([allDay, text]) => (
                <button
                  key={String(allDay)}
                  type="button"
                  role="radio"
                  aria-checked={current.allDay === allDay}
                  onClick={() => patch(selected, { allDay })}
                  className={cn(
                    "min-h-11 rounded-xl border px-4 text-sm font-bold transition",
                    current.allDay === allDay ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec]",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>

            {!current.allDay && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  <span>שעת פתיחה</span>
                  <input
                    type="time"
                    className="field-input"
                    value={current.open}
                    onChange={(event) => patch(selected, { open: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  <span>שעת סגירה</span>
                  <input
                    type="time"
                    className="field-input"
                    value={current.close}
                    onChange={(event) => patch(selected, { close: event.target.value })}
                  />
                </label>
              </div>
            )}

            <button type="button" className="button-secondary mt-3 min-h-11" onClick={copyToOpenDays}>
              <Copy size={15} aria-hidden="true" />
              החלה על כל הימים הפתוחים
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="text-sm font-bold text-[#a4243b]" onClick={() => onChange([])}>
          הסרת שעות הפעילות
        </button>
        <span className="text-xs text-[#8b96a8]">השעות מוצגות בכרטיס לפי שעון ישראל.</span>
      </div>
    </div>
  );
}
