"use client";
/* eslint-disable @next/next/no-img-element */

import type { CSSProperties, ReactNode } from "react";
import { AtSign, BriefcaseBusiness, CalendarDays, Camera, ExternalLink, FileDown, Globe2, Mail, Map, MapPin, MessageCircle, Phone, PlayCircle, Star, UserPlus, Users } from "lucide-react";
import type { CardData, CardWidget, QuickAction, QuickActionType, SmartButton } from "@/lib/types";
import { initials, normalizePhone, whatsappUrl } from "@/lib/utils";
import { safeHref, safeSrc } from "@/lib/safe-url";
import { googleMapsUrl, wazeUrl } from "@/lib/address";

/**
 * נתוני הכרטיס נשמרים כ-JSONB בלי אילוץ על סוג הפעולה, ולכן ערך לא מוכר
 * יכול להגיע מייבוא, מלקוח ישן או מתיקון ידני. הרינדור חייב לשרוד אותו:
 * אייקון ברירת מחדל עדיף על עמוד שקורס.
 */
const actionIcons: Record<QuickActionType, typeof Phone> = {
  phone: Phone, whatsapp: MessageCircle, email: Mail, website: Globe2, waze: Map, google_maps: MapPin, save_contact: UserPlus,
  instagram: Camera, facebook: Users, linkedin: BriefcaseBusiness, tiktok: AtSign, youtube: PlayCircle, calendar: CalendarDays,
};

function actionHref(action: QuickAction, card: CardData) {
  const value = action.value || (["waze", "google_maps"].includes(action.type) ? card.address : "");
  if (action.type === "phone") return `tel:${normalizePhone(value || card.phone)}`;
  if (action.type === "whatsapp") return whatsappUrl(value || card.whatsapp, `היי ${card.ownerName}, הגעתי דרך כרטיס הביקור שלך`);
  if (action.type === "email") return `mailto:${value || card.email}`;
  if (action.type === "save_contact") return `/api/vcard/${card.slug}`;
  // הכתובת המובנית עדיפה. הערך שהוזן בפעולה משמש רק כגיבוי לכרטיסים ותיקים.
  if (action.type === "waze") return wazeUrl(card.cardAddress) || `https://www.waze.com/ul?q=${encodeURIComponent(value)}&navigate=yes`;
  if (action.type === "google_maps") return googleMapsUrl(card.cardAddress) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return safeHref(value) || "#";
}

function smartButtonHref(button: SmartButton) {
  if (button.action === "phone") return `tel:${normalizePhone(button.value)}`;
  if (button.action === "whatsapp") return whatsappUrl(button.value);
  if (button.action === "email") return `mailto:${button.value}`;
  if (button.action === "waze") return `https://www.waze.com/ul?q=${encodeURIComponent(button.value)}&navigate=yes`;
  if (button.action === "google_maps") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(button.value)}`;
  return safeHref(button.value) || "#";
}

function youtubeEmbedUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const clean = (id: string) => (/^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "");
    if (host === "youtu.be") return clean(parsed.pathname.slice(1));
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      return clean(parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1) || "");
    }
  } catch { return ""; }
  return "";
}

function defaultActions(card: CardData): QuickAction[] {
  return [
    { id: "phone", type: "phone", label: "שיחה", value: card.phone },
    { id: "whatsapp", type: "whatsapp", label: "WhatsApp", value: card.whatsapp },
    { id: "email", type: "email", label: "אימייל", value: card.email },
    { id: "maps", type: "google_maps", label: "ניווט", value: card.address },
    { id: "website", type: "website", label: "אתר", value: card.website },
  ].filter((action) => Boolean(action.value)) as QuickAction[];
}

export function CardPreview({ card, compact = false, onAction, contactForm }: { card: CardData; compact?: boolean; onAction?: (action: string) => void; contactForm?: ReactNode }) {
  const style = { "--card-primary": card.primaryColor, "--card-accent": card.accentColor, "--card-button": card.buttonColor, "--card-heading": card.headingColor, "--card-body": card.bodyTextColor } as CSSProperties;
  const quickActions = (card.quickActions.length ? card.quickActions : defaultActions(card)).slice(0, card.quickActionsLimit);
  const widgets = card.widgets.length ? card.widgets.filter((widget) => widget.enabled) : [
    { id: "services", type: "services", title: "השירותים שלי", enabled: true },
    { id: "gallery", type: "gallery", title: "גלריה", enabled: true },
    { id: "contact", type: "contact_form", title: card.contactFormTitle, enabled: true },
  ] as CardWidget[];
  const embedUrl = youtubeEmbedUrl(card.videoUrl);

  function renderWidget(widget: CardWidget) {
    if (widget.type === "smart_buttons" && card.smartButtons.length) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3><div className="mt-3 grid gap-2">{card.smartButtons.map((button) => <a key={button.id} href={smartButtonHref(button)} target={["phone", "email"].includes(button.action) ? undefined : "_blank"} rel="noopener noreferrer" onClick={() => onAction?.("button")} className="group flex items-center gap-3 rounded-2xl border border-[#e2e6ee] p-3.5 hover:border-[var(--card-primary)]"><span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--card-primary)_10%,white)] text-[var(--card-primary)]">{safeSrc(button.imageUrl) ? <img src={safeSrc(button.imageUrl)} alt="" className="h-full w-full object-cover" /> : <ExternalLink size={17} />}</span><span className="min-w-0 flex-1"><strong className="block text-sm">{button.label}</strong>{button.description && <span className="mt-0.5 block text-xs text-[#69768b]">{button.description}</span>}</span><ExternalLink size={15} className="text-[#9aa4b4]" /></a>)}</div></section>;
    if (widget.type === "video" && card.videoUrl) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3>{embedUrl ? <div className="mt-3 aspect-video overflow-hidden rounded-2xl bg-[#111b3b]"><iframe src={embedUrl} title={widget.title} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <a href={safeHref(card.videoUrl) || "#"} target="_blank" rel="noopener noreferrer" onClick={() => onAction?.("video")} className="mt-3 flex items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--card-primary),#111b3b)] p-5 text-white"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><PlayCircle size={22} /></span><strong>צפייה בסרטון</strong></a>}</section>;
    if (widget.type === "gallery" && card.gallery.length) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3><div className={card.galleryStyle === "carousel" ? "mt-3 flex snap-x gap-2 overflow-x-auto pb-2" : "mt-3 grid grid-cols-2 gap-2"}>{card.gallery.slice(0, 12).filter((url) => safeSrc(url)).slice(0, 12).map((url, index) => <img key={`${url}-${index}`} src={safeSrc(url)} alt={`${card.businessName}, תמונה ${index + 1}`} className={card.galleryStyle === "carousel" ? "aspect-[4/5] w-[78%] shrink-0 snap-center rounded-2xl object-cover" : "aspect-square w-full rounded-2xl object-cover"} loading="lazy" />)}</div></section>;
    if (widget.type === "services" && card.services.length) return <section key={widget.id} className="mt-7 border-t border-[#e8ecf3] pt-6"><h3 className="text-base font-extrabold">{widget.title}</h3><div className="mt-3 grid gap-3">{card.services.map((service) => <div key={service.id} className="rounded-2xl border border-[#e4e8f0] p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-bold">{service.title}</h4>{service.price && <span className="shrink-0 text-xs font-bold text-[var(--card-primary)]">{service.price}</span>}</div><p className="mt-1 text-xs leading-5 text-[#657188]">{service.description}</p></div>)}</div></section>;
    if (widget.type === "testimonials" && card.testimonials.length) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3><div className="mt-3 grid gap-3">{card.testimonials.map((item) => <blockquote key={item.id} className="rounded-2xl bg-[#f6f7fb] p-4"><div className="mb-2 flex gap-0.5 text-[#f3a712]" aria-label={`${item.rating} כוכבים`}>{Array.from({ length: item.rating }).map((_, index) => <Star key={index} size={13} fill="currentColor" />)}</div><p className="text-sm leading-6">״{item.text}״</p><footer className="mt-2 text-xs font-bold text-[#647188]">{item.name}</footer></blockquote>)}</div></section>;
    if (widget.type === "hours" && card.businessHours.length) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3><dl className="mt-3 grid gap-2 rounded-2xl bg-[#f6f7fb] p-4 text-sm">{card.businessHours.map((item, index) => <div key={`${item.day}-${index}`} className="flex justify-between gap-4"><dt className="font-bold">{item.day}</dt><dd className="text-[#657188]">{item.hours}</dd></div>)}</dl></section>;
    if (widget.type === "files" && card.files.length) return <section key={widget.id} className="mt-7"><h3 className="text-base font-extrabold">{widget.title}</h3><div className="mt-3 grid gap-2">{card.files.filter((file) => safeSrc(file.url)).map((file) => <a key={file.id} href={safeSrc(file.url)} target="_blank" rel="noopener noreferrer" onClick={() => onAction?.("file")} className="flex items-center justify-between rounded-xl border border-[#e2e6ee] p-3 text-sm font-bold"><span>{file.title}</span><FileDown size={17} className="text-[var(--card-primary)]" /></a>)}</div></section>;
    if (widget.type === "contact_form" && contactForm) return <section key={widget.id} className="mt-7 border-t border-[#e8ecf3] pt-6">{contactForm}</section>;
    return null;
  }

  return <article className="overflow-hidden bg-white text-[var(--card-heading)]" style={style}>
    <div className="relative h-36 overflow-hidden bg-[linear-gradient(135deg,var(--card-primary),#111b3b)]">{safeSrc(card.coverUrl) ? <img src={safeSrc(card.coverUrl)} alt={card.coverAlt} className="h-full w-full object-cover" /> : <><div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/10" /><div className="absolute bottom-[-42px] right-[-25px] h-28 w-28 rounded-full bg-[var(--card-accent)]/40 blur-sm" /></>}</div>
    <div className="relative px-5 pb-6">
      <div className="-mt-11 flex items-end justify-between gap-3"><div className={`grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden border-4 border-white bg-[#eef0ff] text-2xl font-extrabold text-[var(--card-primary)] shadow-lg ${card.logoShape === "circle" ? "rounded-full" : card.logoShape === "square" ? "rounded-none" : "rounded-[25px]"}`}>{safeSrc(card.logoUrl || card.avatarUrl) ? <img src={safeSrc(card.logoUrl || card.avatarUrl)} alt={card.logoUrl ? card.logoAlt : card.avatarAlt} className="h-full w-full object-cover" /> : initials(card.ownerName)}</div><span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#e9fbf7] px-2.5 py-1 text-[11px] font-bold text-[#08735f]"><span className="h-1.5 w-1.5 rounded-full bg-[#14b89d]" /> זמין לפניות</span></div>
      <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--card-primary)]">{card.businessName}</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[var(--card-heading)]">{card.ownerName}</h2><p className="text-sm font-medium text-[var(--card-body)]">{card.roleTitle}</p>{card.slogan && <p className="mt-2 text-sm font-extrabold text-[var(--card-primary)]">{card.slogan}</p>}<p className="mt-3 text-[13px] leading-6 text-[var(--card-body)]">{card.bio}</p></div>
      <div className="mt-5 grid grid-cols-3 gap-2" aria-label="פעולות מהירות">{quickActions.map((action) => { const Icon = actionIcons[action.type] ?? ExternalLink; return <a key={action.id} href={actionHref(action, card)} target={["phone", "whatsapp", "email", "save_contact"].includes(action.type) ? undefined : "_blank"} rel="noopener noreferrer" onClick={() => onAction?.(action.type === "save_contact" ? "contact_save" : action.type)} className="grid min-h-16 place-items-center gap-1 rounded-xl bg-[#f2f4f8] px-1 text-[11px] font-bold text-[var(--card-primary)]"><Icon size={19} /><span className="max-w-full truncate">{action.label}</span></a>; })}</div>
      {card.whatsapp && <a href={whatsappUrl(card.whatsapp, `היי ${card.ownerName}, הגעתי דרך כרטיס הביקור שלך`)} onClick={() => onAction?.("whatsapp_primary")} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--card-button)] px-4 font-bold text-white">{card.ctaLabel || "בואו נדבר"} <MessageCircle size={17} /></a>}
      {!compact && widgets.map(renderWidget)}
    </div>
  </article>;
}
