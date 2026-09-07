"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Search, X } from "lucide-react";
import type { BackgroundCategory } from "@/lib/backgrounds";
import { backgroundCategories, backgroundPresets, countByCategory, getBackground, searchBackgrounds } from "@/lib/backgrounds";
import { FormAlert } from "@/components/ui/field";
import { contrastRatio, readableTextColor } from "@/lib/contrast";
import { cn } from "@/lib/utils";

/**
 * בורר רקעים: חיפוש, סינון לפי קטגוריה, תצוגה מקדימה, וחזרה לבחירה הקודמת.
 * כל האריחים נגישים במקלדת (רדיו סמנטי בתוך fieldset), והמצב הנבחר מסומן
 * גם באייקון ולא בצבע בלבד.
 */
export function BackgroundPicker({
  value,
  headingColor,
  onChange,
}: {
  value: string;
  headingColor: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BackgroundCategory | "all">("all");
  // הבחירה שהייתה לפני העדכון האחרון, כדי לאפשר חזרה בלחיצה אחת.
  const [previous, setPrevious] = useState<string | null>(null);

  const results = useMemo(() => searchBackgrounds(query, category), [query, category]);
  const active = getBackground(value);

  // אזהרת ניגודיות: הרקע קובע אם הטקסט צריך להיות כהה או בהיר.
  const suggested = readableTextColor(active.foreground);
  const ratio = contrastRatio(headingColor, active.foreground === "light" ? "#0b1020" : "#ffffff");
  const lowContrast = active.foreground === "light" ? contrastRatio(headingColor, "#101223") < 3 : contrastRatio(headingColor, "#ffffff") < 3;

  function select(id: string) {
    if (id === value) return;
    setPrevious(value);
    onChange(id);
  }

  return (
    <div className="grid gap-4">
      {/* חיפוש */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">חיפוש רקע לפי שם או גוון</span>
          <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b96a8]" aria-hidden="true" />
          <input
            type="search"
            className="field-input pr-10"
            placeholder="חיפוש: כחול, יוקרה, מינימלי..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute left-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#68758a] hover:bg-[#f2f4f8]"
              aria-label="ניקוי החיפוש"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>

        <p className="text-xs text-[#78859a]" aria-live="polite">
          {results.length} מתוך {backgroundPresets.length} רקעים
        </p>
      </div>

      {/* קטגוריות */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="סינון לפי קטגוריה">
        <button
          type="button"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className={cn(
            "min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-bold",
            category === "all" ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] bg-white text-[#68758a]",
          )}
        >
          הכול ({backgroundPresets.length})
        </button>
        {backgroundCategories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            aria-pressed={category === entry.id}
            className={cn(
              "min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-bold",
              category === entry.id ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] bg-white text-[#68758a]",
            )}
          >
            {entry.label} ({countByCategory(entry.id)})
          </button>
        ))}
      </div>

      {/* אזהרת ניגודיות */}
      {lowContrast && (
        <FormAlert tone="warning" title="ניגודיות נמוכה">
          הרקע <strong>{active.name}</strong> {active.foreground === "light" ? "כהה" : "בהיר"}, וצבע הכותרות שבחרת עלול להיות
          קשה לקריאה עליו. מומלץ להחליף את צבע הכותרות ל
          <code dir="ltr" className="mx-1 rounded bg-white/60 px-1">{suggested}</code>
          או לבחור רקע {active.foreground === "light" ? "בהיר" : "כהה"} יותר.
          {ratio > 0 && <span className="mt-1 block text-xs">יחס הניגודיות הנוכחי: {ratio.toFixed(1)}:1 (נדרש 3:1 לפחות)</span>}
        </FormAlert>
      )}

      {/* חזרה לבחירה הקודמת */}
      {previous && previous !== value && (
        <button
          type="button"
          onClick={() => { const back = previous; setPrevious(value); onChange(back); }}
          className="button-secondary min-h-11 justify-self-start"
        >
          <RotateCcw size={15} aria-hidden="true" />חזרה ל{getBackground(previous).name}
        </button>
      )}

      {/* אריחי הרקעים */}
      {results.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-[#dfe4ec] p-6 text-center">
          <div>
            <p className="font-bold">לא נמצא רקע מתאים</p>
            <p className="mt-1 text-sm text-[#78859a]">אפשר לנקות את החיפוש או לבחור קטגוריה אחרת.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="button-secondary mt-4 min-h-11">
              איפוס הסינון
            </button>
          </div>
        </div>
      ) : (
        <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="sr-only">בחירת רקע לכרטיס</legend>
          {results.map((preset) => {
            const selected = preset.id === value;
            return (
              <label
                key={preset.id}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-2xl border-2 transition",
                  selected ? "border-[#6d4aff] shadow-[0_0_0_3px_#eeeaff]" : "border-[#dfe4ec] hover:border-[#a99feb]",
                  "focus-within:border-[#6d4aff] focus-within:shadow-[0_0_0_3px_#eeeaff]",
                )}
              >
                <input
                  type="radio"
                  name="backgroundPreset"
                  value={preset.id}
                  checked={selected}
                  onChange={() => select(preset.id)}
                  className="sr-only"
                />
                <span className="relative block h-24" style={{ background: preset.css }}>
                  {selected && (
                    <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-[#6d4aff] shadow">
                      <Check size={15} aria-hidden="true" />
                    </span>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                      preset.foreground === "light" ? "bg-black/35 text-white" : "bg-white/70 text-[#0b1020]",
                    )}
                  >
                    {preset.foreground === "light" ? "טקסט בהיר" : "טקסט כהה"}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 bg-white px-3 py-2">
                  <span className="text-sm font-bold">{preset.name}</span>
                  {selected && <span className="text-[11px] font-bold text-[#6d4aff]">נבחר</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
