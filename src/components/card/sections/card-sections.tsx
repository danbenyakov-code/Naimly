"use client";
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import { ExternalLink, FileDown, PlayCircle, Star } from "lucide-react";
import type { CardData } from "@/lib/types";
import { safeHref, safeSrc } from "@/lib/safe-url";
import { smartButtonHref } from "@/lib/card-actions";
import { SectionShell } from "@/components/card/sections/section-shell";

/**
 * מקטעי הכרטיס הציבורי.
 *
 * הופרדו מ-card-preview כדי שכל מקטע יהיה ניתן לבדיקה ולשינוי בנפרד,
 * וכדי שהתבניות יוכלו לסדר אותם מחדש בלי לגעת בלוגיקה שלהם.
 *
 * כל מקטע אחראי בעצמו להחליט שאין לו מה להציג, ומחזיר null במקרה כזה.
 */

type SectionProps = { card: CardData; title: string; onAction?: (action: string) => void };

/** קישור YouTube להטמעה, או "" כשהוא אינו YouTube תקין. */
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
  } catch {
    return "";
  }
  return "";
}

export function SmartButtonsSection({ card, title, onAction }: SectionProps) {
  return (
    <SectionShell title={title} hasContent={card.smartButtons.length > 0}>
      <div className="mt-3 grid gap-2">
        {card.smartButtons.map((button) => (
          <a
            key={button.id}
            href={smartButtonHref(button)}
            target={["phone", "email"].includes(button.action) ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={() => onAction?.("button")}
            className="group flex items-center gap-3 rounded-2xl border border-[#e2e6ee] p-3.5 hover:border-[var(--card-primary)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--card-primary)_10%,white)] text-[var(--card-primary)]">
              {safeSrc(button.imageUrl) ? <img src={safeSrc(button.imageUrl)} alt="" className="h-full w-full object-cover" /> : <ExternalLink size={17} />}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{button.label}</strong>
              {button.description && <span className="mt-0.5 block text-xs text-[#69768b]">{button.description}</span>}
            </span>
            <ExternalLink size={15} className="text-[#9aa4b4]" aria-hidden="true" />
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

export function VideoSection({ card, title, onAction }: SectionProps) {
  // מספר סרטונים ולא אחד: המכסה במסלול מבדילה בין מקצועי לפרימיום.
  const videos = (card.videos.length ? card.videos : [card.videoUrl]).filter(Boolean);

  return (
    <SectionShell title={title} hasContent={videos.length > 0}>
      <div className="mt-3 grid gap-3">
        {videos.map((url, index) => {
          const embed = youtubeEmbedUrl(url);
          if (embed) {
            return (
              <div key={`${url}-${index}`} className="aspect-video overflow-hidden rounded-2xl bg-[#111b3b]">
                <iframe
                  src={embed}
                  title={videos.length > 1 ? `${title} ${index + 1}` : title}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          return (
            <a
              key={`${url}-${index}`}
              href={safeHref(url) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onAction?.("video")}
              className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--card-primary),#111b3b)] p-5 text-white"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
                <PlayCircle size={22} aria-hidden="true" />
              </span>
              <strong>צפייה בסרטון</strong>
            </a>
          );
        })}
      </div>
    </SectionShell>
  );
}

export function GallerySection({ card, title }: SectionProps) {
  /*
   * המכסה נקבעת במסלול ולא בקוד. תקרה קשיחה של 12 הציגה חצי גלריה
   * ללקוח פרימיום שמשלם על 24, בלי שום הודעה.
   */
  const images = card.gallery.filter((url) => safeSrc(url));
  const carousel = card.galleryStyle === "carousel";

  return (
    <SectionShell title={title} hasContent={images.length > 0}>
      <div className={carousel ? "mt-3 flex snap-x gap-2 overflow-x-auto pb-2" : "mt-3 grid grid-cols-2 gap-2"}>
        {images.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={safeSrc(url)}
            alt={`${card.businessName}, תמונה ${index + 1}`}
            className={carousel ? "aspect-[4/5] w-[78%] shrink-0 snap-center rounded-2xl object-cover" : "aspect-square w-full rounded-2xl object-cover"}
            loading="lazy"
            decoding="async"
            /*
             * sizes אומר לדפדפן כמה רוחב התמונה תופסת בפועל, כדי שלא
             * יוריד קובץ ברוחב מסך מלא עבור משבצת של חצי עמודה.
             */
            sizes={carousel ? "(max-width: 620px) 78vw, 480px" : "(max-width: 620px) 50vw, 300px"}
            width={carousel ? 480 : 300}
            height={carousel ? 600 : 300}
          />
        ))}
      </div>
    </SectionShell>
  );
}

export function ServicesSection({ card, title }: SectionProps) {
  return (
    <SectionShell title={title} hasContent={card.services.length > 0} divided>
      <div className="mt-3 grid gap-3">
        {card.services.map((service) => (
          <div key={service.id} className="rounded-2xl border border-[#e4e8f0] p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-bold">{service.title}</h4>
              {service.price && <span className="shrink-0 text-xs font-bold text-[var(--card-primary)]">{service.price}</span>}
            </div>
            {service.description && <p className="mt-1 text-xs leading-5 text-[#657188]">{service.description}</p>}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function TestimonialsSection({ card, title }: SectionProps) {
  return (
    <SectionShell title={title} hasContent={card.testimonials.length > 0}>
      <div className="mt-3 grid gap-3">
        {card.testimonials.map((item) => (
          <blockquote key={item.id} className="rounded-2xl bg-[#f6f7fb] p-4">
            <div className="mb-2 flex gap-0.5 text-[#f3a712]" aria-label={`${item.rating} כוכבים`}>
              {Array.from({ length: item.rating }).map((_, index) => (
                <Star key={index} size={13} fill="currentColor" aria-hidden="true" />
              ))}
            </div>
            <p className="text-sm leading-6">״{item.text}״</p>
            <footer className="mt-2 text-xs font-bold text-[#647188]">{item.name}</footer>
          </blockquote>
        ))}
      </div>
    </SectionShell>
  );
}

export function FilesSection({ card, title, onAction }: SectionProps) {
  const files = card.files.filter((file) => safeSrc(file.url));

  return (
    <SectionShell title={title} hasContent={files.length > 0}>
      <div className="mt-3 grid gap-2">
        {files.map((file) => (
          <a
            key={file.id}
            href={safeSrc(file.url)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.("file")}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e6ee] p-3 text-sm font-bold"
          >
            <span className="min-w-0">
              <span className="block truncate">{file.title}</span>
              {file.description && <span className="mt-0.5 block text-xs font-normal text-[#69768b]">{file.description}</span>}
            </span>
            <FileDown size={17} className="shrink-0 text-[var(--card-primary)]" aria-hidden="true" />
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

export function ContactFormSection({ children }: { children: ReactNode }) {
  return (
    <SectionShell hasContent={Boolean(children)} divided>
      {children}
    </SectionShell>
  );
}
