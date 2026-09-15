"use client";

import { CalendarDays, MessageCircle, Phone, Send } from "lucide-react";
import type { CardData, PrimaryCtaType } from "@/lib/types";
import { whatsappLink } from "@/lib/contact-source";
import { normalizePhone } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";

/**
 * הכפתור הראשי של הכרטיס (BENCH-003).
 *
 * עד כה הכפתור היה קשיח ל-WhatsApp: בעל כרטיס שרצה "התקשרו" או
 * "השאירו פרטים" לא יכול היה לבחור, ו-ctaLabel שימש רק כטקסט.
 *
 * העיקרון: **פעולה אחת ראשית, לא חמש שוות.** שורת הפעולות המהירות
 * משנית לו, ולכן הוא היחיד שמקבל צבע מלא.
 *
 * כפתור בלי יעד תקין אינו מוצג — קישור ראשי שבור גרוע מהיעדר כפתור.
 */
const icons: Record<PrimaryCtaType, typeof Phone> = {
  whatsapp: MessageCircle,
  phone: Phone,
  lead: Send,
  meeting: CalendarDays,
};

const defaultLabels: Record<PrimaryCtaType, string> = {
  whatsapp: "שליחת הודעה בוואטסאפ",
  phone: "התקשרו אליי",
  lead: "השארת פרטים",
  meeting: "קביעת פגישה",
};

export const primaryCtaOptions: Array<{ type: PrimaryCtaType; label: string; hint: string }> = [
  { type: "whatsapp", label: "וואטסאפ", hint: "נפתחת שיחה עם הודעה מוכנה" },
  { type: "phone", label: "שיחת טלפון", hint: "חיוג ישיר מהנייד" },
  { type: "lead", label: "השארת פרטים", hint: "גלילה לטופס הפנייה בכרטיס" },
  { type: "meeting", label: "קביעת פגישה", hint: "קישור ליומן חיצוני שתגדיר" },
];

/** היעד של הכפתור, או "" כשאין יעד תקין. */
export function primaryCtaHref(card: CardData): string {
  const cta = card.primaryCta;

  if (cta.type === "whatsapp") {
    return whatsappLink(card.whatsapp || card.phone, `היי ${card.ownerName}, הגעתי דרך כרטיס הביקור שלך`);
  }
  if (cta.type === "phone") {
    const phone = normalizePhone(card.phone || card.whatsapp);
    return phone ? `tel:${phone}` : "";
  }
  if (cta.type === "lead") {
    // עוגן פנימי: הטופס נמצא באותו עמוד, ואין סיבה לנווט.
    return "#card-contact-form";
  }
  return safeHref(cta.value) || "";
}

export function PrimaryCtaButton({ card, onAction }: { card: CardData; onAction?: (action: string) => void }) {
  const cta = card.primaryCta;
  const href = primaryCtaHref(card);
  if (!href) return null;

  const Icon = icons[cta.type] || MessageCircle;
  // ctaLabel הישן נשמר כברירת מחדל, כדי שכרטיס ותיק לא יאבד את הטקסט שלו.
  const label = cta.label.trim() || card.ctaLabel?.trim() || defaultLabels[cta.type];
  const external = cta.type === "meeting";

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={() => onAction?.(cta.type === "lead" ? "cta_lead" : cta.type)}
      className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-extrabold text-white shadow-[0_10px_26px_rgba(11,24,48,.18)] transition active:scale-[.99]"
      style={{ background: "var(--card-button)" }}
    >
      <Icon size={19} aria-hidden="true" />
      {label}
    </a>
  );
}
