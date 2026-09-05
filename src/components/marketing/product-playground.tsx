"use client";

import { useState } from "react";
import { Check, GripVertical, LayoutGrid, Palette, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/card/card-preview";
import { demoCard } from "@/lib/demo-data";
import type { CardWidgetType } from "@/lib/types";
import { cn } from "@/lib/utils";

const palettes = [
  { name: "סגול", primary: "#6d4aff", accent: "#14d9c4" },
  { name: "לילה", primary: "#172033", accent: "#ef9b50" },
  { name: "ים", primary: "#087b8b", accent: "#75d5c7" },
];
const labels: Partial<Record<CardWidgetType, string>> = { smart_buttons: "כפתורים", services: "שירותים", gallery: "קרוסלה", video: "סרטון", testimonials: "המלצות", contact_form: "טופס לידים" };

export function ProductPlayground() {
  const [card, setCard] = useState({ ...demoCard, videoUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ" });
  const toggle = (type: CardWidgetType) => setCard((current) => ({ ...current, widgets: current.widgets.map((widget) => widget.type === type ? { ...widget, enabled: !widget.enabled } : widget) }));
  return <div className="grid items-start gap-8 lg:grid-cols-[1fr_390px]">
    <div className="rounded-[28px] border border-white/10 bg-white/[.055] p-5 backdrop-blur sm:p-7">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#7160eb] text-white"><LayoutGrid size={21} /></span><div><strong className="block text-lg">בונה הווידג׳טים</strong><span className="text-sm text-white/55">לוחצים ורואים את הכרטיס משתנה</span></div></div>
      <div className="mt-5"><div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/70"><GripVertical size={16} />רכיבים פעילים</div><div className="grid gap-2 sm:grid-cols-2">{card.widgets.filter((widget) => labels[widget.type]).map((widget) => <button key={widget.id} type="button" aria-pressed={widget.enabled} onClick={() => toggle(widget.type)} className={cn("flex min-h-12 items-center justify-between rounded-xl border px-3.5 text-sm font-bold transition", widget.enabled ? "border-[#7665ed] bg-[#7665ed]/20 text-white" : "border-white/10 bg-white/[.03] text-white/45")}><span>{labels[widget.type]}</span><span className={cn("grid h-6 w-6 place-items-center rounded-full", widget.enabled ? "bg-[#6fe0cf] text-[#0a3832]" : "bg-white/10")}><Check size={14} /></span></button>)}</div></div>
      <div className="mt-6"><div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/70"><Palette size={16} />צבעי מותג</div><div className="flex flex-wrap gap-2">{palettes.map((palette) => <button key={palette.name} type="button" onClick={() => setCard((current) => ({ ...current, primaryColor: palette.primary, accentColor: palette.accent }))} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm"><span className="h-5 w-5 rounded-full" style={{ background: palette.primary }} /><span>{palette.name}</span></button>)}</div></div>
      <div className="mt-6 rounded-2xl border border-[#6fe0cf]/25 bg-[#6fe0cf]/10 p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#8ef3e4]"><Sparkles size={16} />קישורים חכמים</div><p className="mt-1 text-sm leading-6 text-white/60">מזינים כתובת פעם אחת והמערכת יוצרת לבד Waze ו־Google Maps. כך גם בטלפון, אימייל ו־WhatsApp.</p></div>
    </div>
    <div className="mx-auto w-full max-w-[350px] rounded-[38px] border-[9px] border-[#101522] bg-white shadow-[0_34px_90px_rgba(0,0,0,.38)]"><div className="max-h-[680px] overflow-y-auto rounded-[28px]"><CardPreview card={card} contactForm={<div className="rounded-2xl bg-[#f5f6fa] p-4 text-center text-sm font-bold">טופס לידים דינמי</div>} /></div></div>
  </div>;
}
