"use client";

import Link from "next/link";
import { Accessibility, ALargeSmall, Contrast, Link2, Mail, MessageCircle, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/config";
import { cn } from "@/lib/utils";

type Preferences = { fontScale: 100 | 112 | 125; contrast: boolean; links: boolean; readable: boolean; reducedMotion: boolean };
const defaults: Preferences = { fontScale: 100, contrast: false, links: false, readable: false, reducedMotion: false };

function applyPreferences(value: Preferences) {
  const root = document.documentElement;
  root.dataset.a11yFont = String(value.fontScale);
  root.classList.toggle("a11y-high-contrast", value.contrast);
  root.classList.toggle("a11y-links", value.links);
  root.classList.toggle("a11y-readable", value.readable);
  root.classList.toggle("a11y-reduced-motion", value.reducedMotion);
}

export function FloatingTools() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem("naimly-accessibility");
        if (saved) { const next = { ...defaults, ...JSON.parse(saved) } as Preferences; setPreferences(next); applyPreferences(next); }
      } catch { /* ignore an invalid local preference */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>("button, a");
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
      if (!items.length) return;
      const firstItem = items[0]; const lastItem = items.at(-1)!;
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function update(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next); applyPreferences(next); localStorage.setItem("naimly-accessibility", JSON.stringify(next));
  }

  const contactHref = brand.supportWhatsapp ? `https://wa.me/${brand.supportWhatsapp.replace(/\D/g, "")}` : `mailto:${brand.supportEmail}`;
  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="floating-tool floating-tool-accessibility" aria-label="פתיחת כלי נגישות"><Accessibility aria-hidden="true" size={21} /><span>נגישות</span></button>
    <a href={contactHref} className="floating-tool floating-tool-contact" aria-label="יצירת קשר עם NAIMLY">{brand.supportWhatsapp ? <MessageCircle aria-hidden="true" size={20} /> : <Mail aria-hidden="true" size={20} />}<span>צרו קשר</span></a>
    {open && <div className="fixed inset-0 z-[120] bg-[#070b16]/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); triggerRef.current?.focus(); } }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="accessibility-title" className="absolute left-3 top-1/2 max-h-[85vh] w-[min(390px,calc(100%-24px))] -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[26px] bg-white p-5 shadow-[0_28px_90px_rgba(7,11,22,.35)] sm:left-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#6d4aff]">כלי עזר לתצוגה</p><h2 id="accessibility-title" className="text-2xl font-black">התאמת הנגישות</h2></div><button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f3f7]" aria-label="סגירת כלי הנגישות"><X size={19} /></button></div><p className="mt-2 text-sm leading-6 text-[#607087]">הכלים משפרים את נוחות התצוגה. הנגישות באתר מיושמת גם בקוד ובמבנה התוכן.</p><div className="mt-5 grid gap-2"><div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl border border-[#dfe5ef] p-3"><span className="flex items-center gap-2 font-bold"><ALargeSmall size={19} />גודל טקסט</span><button type="button" onClick={() => update({ fontScale: preferences.fontScale === 125 ? 112 : 100 })} className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f3f7]" aria-label="הקטנת טקסט"><Minus size={18} /></button><button type="button" onClick={() => update({ fontScale: preferences.fontScale === 100 ? 112 : 125 })} className="grid h-11 w-11 place-items-center rounded-xl bg-[#ede9ff] text-[#5134cc]" aria-label="הגדלת טקסט"><Plus size={18} /></button></div><ToolToggle active={preferences.contrast} onClick={() => update({ contrast: !preferences.contrast })} icon={<Contrast size={19} />} label="ניגודיות מוגברת" /><ToolToggle active={preferences.links} onClick={() => update({ links: !preferences.links })} icon={<Link2 size={19} />} label="הדגשת קישורים" /><ToolToggle active={preferences.readable} onClick={() => update({ readable: !preferences.readable })} icon={<ALargeSmall size={19} />} label="גופן קריא" /><ToolToggle active={preferences.reducedMotion} onClick={() => update({ reducedMotion: !preferences.reducedMotion })} icon={<span aria-hidden="true">◼</span>} label="עצירת אנימציות" /></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => update(defaults)} className="button-secondary flex-1"><RotateCcw size={17} />איפוס</button><Link href="/accessibility" onClick={() => setOpen(false)} className="button-primary flex-1">הצהרת נגישות</Link></div></div></div>}
  </>;
}

function ToolToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("flex min-h-12 items-center justify-between rounded-2xl border px-4 text-right font-bold", active ? "border-[#6d4aff] bg-[#ede9ff] text-[#3f29a8]" : "border-[#dfe5ef] bg-white")}><span className="flex items-center gap-2">{icon}{label}</span><span className={cn("h-3 w-3 rounded-full border", active ? "border-[#6d4aff] bg-[#6d4aff]" : "border-[#a7b0bf]")} aria-hidden="true" /></button>;
}
