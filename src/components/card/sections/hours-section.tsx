"use client";

import { Clock3 } from "lucide-react";
import type { CardData } from "@/lib/types";
import { groupHours, openState, openStateLabel, nowInBusinessTime } from "@/lib/opening-hours";
import { SectionShell } from "@/components/card/sections/section-shell";

/**
 * שעות פעילות.
 *
 * מציג את הסטטוס הנוכחי בראש המקטע ואת השבוע מתחתיו, כשימים רצופים
 * בעלי אותן שעות מכווצים לשורה אחת — כך עסקים מציגים שעות בפועל, ושבע
 * שורות זהות הן רעש.
 *
 * היום הנוכחי מודגש כדי שהעין תמצא אותו בלי לקרוא את כל הטבלה.
 *
 * כשאין שעות מובנות, מוצג הטקסט החופשי הישן כפי שהוא — כרטיס ותיק לא
 * מאבד את מה שהוזן בו.
 */
export function HoursSection({ card, title }: { card: CardData; title: string }) {
  const structured = card.openingHours || [];
  const legacy = card.businessHours || [];

  if (!structured.length) {
    return (
      <SectionShell title={title} hasContent={legacy.length > 0}>
        <dl className="mt-3 grid gap-2 rounded-2xl bg-[#f6f7fb] p-4 text-sm">
          {legacy.map((item, index) => (
            <div key={`${item.day}-${index}`} className="flex justify-between gap-4">
              <dt className="font-bold">{item.day}</dt>
              <dd className="text-[#657188]">{item.hours}</dd>
            </div>
          ))}
        </dl>
      </SectionShell>
    );
  }

  const state = openState(structured);
  const label = openStateLabel(state);
  const today = nowInBusinessTime().day;
  const groups = groupHours(structured);

  return (
    <SectionShell title={title} hasContent={groups.length > 0}>
      {label && (
        <p
          className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{
            background: state.state === "open" ? "#e9fbf7" : "#f4f5f8",
            color: state.state === "open" ? "#08735f" : "#5f6d83",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: state.state === "open" ? "#14b89d" : "#9aa4b4" }}
            aria-hidden="true"
          />
          {label}
        </p>
      )}

      <dl className="mt-3 grid gap-1 rounded-2xl bg-[#f6f7fb] p-4 text-sm">
        {groups.map((group) => {
          const isToday = group.days.includes(today);
          return (
            <div
              key={group.label}
              className={`flex justify-between gap-4 rounded-lg px-2 py-1.5 ${isToday ? "bg-white font-bold" : ""}`}
            >
              <dt className={isToday ? "" : "font-bold"}>
                {group.label}
                {isToday && <span className="ms-1.5 text-xs font-normal text-[var(--card-primary)]">היום</span>}
              </dt>
              <dd className={group.value === "סגור" ? "text-[#9aa4b4]" : "text-[#657188]"}>{group.value}</dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-[#8b96a8]">
        <Clock3 size={12} aria-hidden="true" />
        השעות לפי שעון ישראל
      </p>
    </SectionShell>
  );
}
