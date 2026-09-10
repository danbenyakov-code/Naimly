"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { IconCategory } from "@/lib/icons";
import { getIcon, iconCategories, iconRegistry, searchIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

const RECENT_KEY = "naimly-recent-icons";
const RECENT_LIMIT = 8;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((id) => typeof id === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

/**
 * בורר אייקונים: חיפוש, קטגוריות, אחרונים שנבחרו, וניווט מלא במקלדת.
 * נפתח כדיאלוג — בנייד כגיליון תחתון, במחשב כחלון ממורכז.
 */
export function IconPicker({
  value,
  onChange,
  label = "אייקון",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IconCategory | "all">("all");
  // נטען פעם אחת בעצלתיים; localStorage אינו זמין בשרת ולכן דרך פונקציה.
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecent()));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const active = getIcon(value);
  const ActiveIcon = active.Icon;
  const results = useMemo(() => searchIcons(query, category), [query, category]);

  useEffect(() => {
    if (!open) return;
    const focus = requestAnimationFrame(() => searchRef.current?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(focus);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function select(id: string) {
    onChange(id);
    try {
      const next = [id, ...readRecent().filter((item) => item !== id)].slice(0, RECENT_LIMIT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch {
      // אחסון חסום — הבחירה עדיין נשמרת בכרטיס עצמו.
    }
    setOpen(false);
    triggerRef.current?.focus();
  }

  const recentEntries = recent.map((id) => getIcon(id)).filter((entry) => entry.id !== "link" || recent.includes("link"));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setRecent(readRecent()); setOpen(true); }}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#cfd7e5] bg-white px-3 text-right transition hover:border-[#a99feb]"
        aria-label={`${label}: ${active.label}. לחצו לשינוי`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f1efff] text-[#6d4aff]">
          <ActiveIcon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[#8b96a8]">{label}</span>
          <span className="block truncate text-sm font-semibold">{active.label}</span>
        </span>
        <Search size={16} className="shrink-0 text-[#8b96a8]" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-[#071020]/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => { if (event.target === event.currentTarget) { setOpen(false); triggerRef.current?.focus(); } }}
        >
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-t-3xl bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:rounded-3xl sm:p-6">
            <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-[#dfe4ec] sm:hidden" />

            <div className="flex shrink-0 items-center justify-between gap-3">
              <h2 id={titleId} className="text-lg font-black">בחירת אייקון</h2>
              <button
                type="button"
                onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
                className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f3f7] text-[#5a677c]"
                aria-label="סגירה"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* חיפוש */}
            <label className="relative mt-4 block shrink-0">
              <span className="sr-only">חיפוש אייקון לפי שם או תחום</span>
              <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b96a8]" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                className="field-input pr-10"
                placeholder="חיפוש: טלפון, מסעדה, כושר..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {/* קטגוריות */}
            <div className="-mx-1 mt-3 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="סינון לפי תחום">
              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={cn(
                  "min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-bold",
                  category === "all" ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] text-[#68758a]",
                )}
              >
                הכול ({iconRegistry.length})
              </button>
              {iconCategories.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setCategory(entry.id)}
                  aria-pressed={category === entry.id}
                  className={cn(
                    "min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-bold",
                    category === entry.id ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] text-[#68758a]",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {/* אחרונים */}
              {!query && category === "all" && recentEntries.length > 0 && (
                <section className="mb-4">
                  <h3 className="mb-2 text-xs font-bold text-[#8b96a8]">נבחרו לאחרונה</h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {recentEntries.map((entry) => (
                      <IconTile key={`recent-${entry.id}`} entry={entry} selected={entry.id === value} onSelect={select} />
                    ))}
                  </div>
                </section>
              )}

              {results.length === 0 ? (
                <div className="grid min-h-32 place-items-center text-center">
                  <div>
                    <p className="font-bold">לא נמצא אייקון מתאים</p>
                    <p className="mt-1 text-sm text-[#78859a]">אפשר לנקות את החיפוש או לבחור תחום אחר.</p>
                    <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="button-secondary mt-4 min-h-11">
                      איפוס הסינון
                    </button>
                  </div>
                </div>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-[#8b96a8]">
                    {query || category !== "all" ? `${results.length} תוצאות` : "כל האייקונים"}
                  </legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {results.map((entry) => (
                      <IconTile key={entry.id} entry={entry} selected={entry.id === value} onSelect={select} />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IconTile({
  entry,
  selected,
  onSelect,
}: {
  entry: ReturnType<typeof getIcon>;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = entry.Icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      aria-pressed={selected}
      className={cn(
        "relative grid min-h-[76px] place-items-center gap-1 rounded-xl border p-2 text-center transition",
        selected ? "border-[#6d4aff] bg-[#f7f5ff]" : "border-[#e2e6ee] hover:border-[#a99feb] hover:bg-[#faf9ff]",
      )}
    >
      {selected && (
        <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#6d4aff] text-white">
          <Check size={11} aria-hidden="true" />
        </span>
      )}
      <Icon size={22} className={selected ? "text-[#6d4aff]" : "text-[#53627a]"} aria-hidden="true" />
      <span className="line-clamp-2 text-[11px] leading-tight text-[#68758a]">{entry.label}</span>
    </button>
  );
}
