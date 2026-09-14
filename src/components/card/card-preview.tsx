"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { CardData, CardWidget } from "@/lib/types";
import { initials } from "@/lib/utils";
import { safeSrc } from "@/lib/safe-url";
import { isActionUsable } from "@/lib/contact-source";
import { actionHref, actionIconUrl, actionIcons, defaultActions, opensInSameTab } from "@/lib/card-actions";
import { cardTemplate, orderWidgets } from "@/lib/card-templates";
import { openState, openStateLabel } from "@/lib/opening-hours";
import { PrimaryCtaButton } from "@/components/card/primary-cta";
import { HoursSection } from "@/components/card/sections/hours-section";
import {
  ContactFormSection, FilesSection, GallerySection, ServicesSection,
  SmartButtonsSection, TestimonialsSection, VideoSection,
} from "@/components/card/sections/card-sections";

/**
 * הכרטיס הציבורי.
 *
 * הרכיב מרכיב מקטעים ואינו מכיל את הסימון שלהם: כל מקטע יושב בקובץ
 * משלו וניתן לבדיקה בנפרד. התבנית קובעת גבהים, יישור וסדר — היא תצורה
 * ולא רכיב, ולכן החלפת תבנית אינה יכולה למחוק תוכן.
 *
 * ה-API נשאר זהה לגרסה הקודמת, כדי שהעורך והתצוגה החיה לא ישתנו.
 */

/**
 * תמונה שנעלמת במקום להישבר.
 *
 * מקור התמונה הוא בשליטת הלקוח — קישור חיצוני, קובץ שנמחק או תמונת
 * דוגמה שטרם הועלתה. אייקון "תמונה שבורה" בכרטיס עסקי גרוע מכלום,
 * ולכן במקרה כשל מוחזר ה-fallback המקורי של הרכיב.
 */
function SafeImage({
  src,
  fallback = null,
  ...rest
}: { src?: string; fallback?: ReactNode } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const [failed, setFailed] = useState(false);
  const safe = safeSrc(src);
  if (!safe || failed) return <>{fallback}</>;
  return <img src={safe} onError={() => setFailed(true)} {...rest} alt={rest.alt ?? ""} />;
}

/**
 * המיקום שמוצג ב-Hero (BENCH-001).
 *
 * עיר ואזור שירות הוזנו ולא הוצגו מעולם. לקוח שמחפש ספק מקומי רוצה
 * לדעת את זה מעל הקפל, לא בתוך טופס הניווט.
 */
function heroLocation(card: CardData): string {
  const city = card.cardAddress?.city?.trim() || "";
  const area = card.areaServed?.trim() || "";
  if (city && area && city !== area) return `${city} · ${area}`;
  return city || area;
}

export function CardPreview({
  card,
  compact = false,
  onAction,
  contactForm,
}: {
  card: CardData;
  compact?: boolean;
  onAction?: (action: string) => void;
  contactForm?: ReactNode;
}) {
  const style = {
    "--card-primary": card.primaryColor,
    "--card-accent": card.accentColor,
    "--card-button": card.buttonColor,
    "--card-heading": card.headingColor,
    "--card-body": card.bodyTextColor,
  } as CSSProperties;

  const template = cardTemplate(card.template);

  const quickActions = (card.quickActions.length ? card.quickActions : defaultActions(card))
    .filter((action) => isActionUsable(action, card))
    .filter((action) => Boolean(actionHref(action, card)))
    .slice(0, card.quickActionsLimit);

  const enabled = card.widgets.length
    ? card.widgets.filter((widget) => widget.enabled)
    : ([
        { id: "services", type: "services", title: "השירותים שלי", enabled: true },
        { id: "gallery", type: "gallery", title: "גלריה", enabled: true },
        { id: "contact", type: "contact_form", title: card.contactFormTitle, enabled: true },
      ] as CardWidget[]);

  const widgets = orderWidgets(enabled, card.template);

  /*
   * QA-004: הכרטיס המלא נושא H1 יחיד. בתצוגה המוקטנת הוא רכיב בתוך
   * עמוד אחר, ולכן יורד ל-H2.
   */
  const Heading = compact ? "h2" : "h1";

  // התג נגזר משעות הפעילות. בלי שעות מוגדרות אין סטטוס — ואין תג.
  const availability = openStateLabel(openState(card.openingHours || []));
  const location = heroLocation(card);

  function renderWidget(widget: CardWidget) {
    const props = { card, title: widget.title, onAction };
    switch (widget.type) {
      case "smart_buttons": return <SmartButtonsSection key={widget.id} {...props} />;
      case "video": return <VideoSection key={widget.id} {...props} />;
      case "gallery": return <GallerySection key={widget.id} {...props} />;
      case "services": return <ServicesSection key={widget.id} {...props} />;
      case "testimonials": return <TestimonialsSection key={widget.id} {...props} />;
      case "hours": return <HoursSection key={widget.id} card={card} title={widget.title} />;
      case "files": return <FilesSection key={widget.id} {...props} />;
      case "contact_form":
        return (
          <div key={widget.id} id="card-contact-form" className="scroll-mt-4">
            <ContactFormSection>{contactForm}</ContactFormSection>
          </div>
        );
      default: return null;
    }
  }

  return (
    <article className="overflow-hidden bg-white text-[var(--card-heading)]" style={style}>
      {template.coverHeight > 0 && (
        <div
          className="relative overflow-hidden bg-[linear-gradient(135deg,var(--card-primary),#111b3b)]"
          style={{ height: template.coverHeight }}
        >
          <SafeImage
            src={card.coverUrl}
            alt={card.coverAlt}
            className="h-full w-full object-cover"
            fallback={
              <>
                <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <div className="absolute bottom-[-42px] right-[-25px] h-28 w-28 rounded-full bg-[var(--card-accent)]/40 blur-sm" />
              </>
            }
          />
        </div>
      )}

      <div className="relative px-5 pb-6">
        <div
          className={`flex items-end gap-3 ${template.align === "center" ? "flex-col items-center" : "justify-between"}`}
          style={{ marginTop: template.identity === "overlap" ? -(template.logoSize / 2) - 0 : 20 }}
        >
          <div
            className={`grid shrink-0 place-items-center overflow-hidden border-4 border-white bg-[#eef0ff] text-2xl font-extrabold text-[var(--card-primary)] shadow-lg ${
              card.logoShape === "circle" ? "rounded-full" : card.logoShape === "square" ? "rounded-none" : "rounded-[25px]"
            }`}
            style={{ height: template.logoSize, width: template.logoSize }}
          >
            <SafeImage
              src={card.logoUrl || card.avatarUrl}
              alt={card.logoUrl ? card.logoAlt : card.avatarAlt}
              className="h-full w-full object-cover"
              fallback={initials(card.ownerName)}
            />
          </div>

          {availability && (
            <span
              className="mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: availability.startsWith("פתוח") ? "#e9fbf7" : "#f4f5f8",
                color: availability.startsWith("פתוח") ? "#08735f" : "#5f6d83",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: availability.startsWith("פתוח") ? "#14b89d" : "#9aa4b4" }}
                aria-hidden="true"
              />
              {availability}
            </span>
          )}
        </div>

        <div className={`mt-4 ${template.align === "center" ? "text-center" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--card-primary)]">{card.businessName}</p>
          <Heading className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[var(--card-heading)]">
            {card.ownerName}
          </Heading>
          <p className="text-sm font-medium text-[var(--card-body)]">{card.roleTitle}</p>

          {location && (
            <p
              className={`mt-1.5 flex items-center gap-1 text-sm text-[var(--card-body)] ${
                template.align === "center" ? "justify-center" : ""
              }`}
            >
              <MapPin size={14} className="shrink-0 text-[var(--card-primary)]" aria-hidden="true" />
              {location}
            </p>
          )}

          {card.slogan && <p className="mt-2 text-sm font-extrabold text-[var(--card-primary)]">{card.slogan}</p>}
          {card.bio && <p className="mt-3 text-[13px] leading-6 text-[var(--card-body)]">{card.bio}</p>}
        </div>

        {quickActions.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2" aria-label="פעולות מהירות">
            {quickActions.map((action) => {
              const Icon = actionIcons[action.type] ?? ExternalLink;
              const custom = actionIconUrl(action);
              return (
                <a
                  key={action.id}
                  href={actionHref(action, card)}
                  target={opensInSameTab(action.type) ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={() => onAction?.(action.type === "save_contact" ? "contact_save" : action.type)}
                  className="grid min-h-16 place-items-center gap-1 rounded-xl bg-[#f2f4f8] px-1 text-[11px] font-bold text-[var(--card-primary)]"
                >
                  {custom ? (
                    <img src={custom} alt="" className="h-[19px] w-[19px] object-contain" />
                  ) : (
                    <Icon size={19} aria-hidden="true" />
                  )}
                  <span className="max-w-full truncate">{action.label}</span>
                </a>
              );
            })}
          </div>
        )}

        <PrimaryCtaButton card={card} onAction={onAction} />

        {!compact && widgets.map(renderWidget)}
      </div>
    </article>
  );
}
