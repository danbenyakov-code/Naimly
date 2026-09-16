"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, QrCode, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { CardPreview } from "@/components/card/card-preview";
import { Logo } from "@/components/logo";
import { ErrorSummary, focusErrorSummary } from "@/components/ui/field";
import type { CardData, ContactFormField } from "@/lib/types";
import { backgroundCss } from "@/lib/backgrounds";
import { CONSENT_EVENT, hasConsent, type ConsentState } from "@/lib/consent";
import { countDigits, isEmailLike } from "@/lib/email-format";
import { ContactFab } from "@/components/card/contact-fab";
import { cardDir, cardStrings, toCardLanguage, type CardStrings } from "@/lib/card-i18n";
import { HONEYPOT_FIELD, honeypotInputProps } from "@/lib/honeypot";
import { visibleFields } from "@/lib/contact-form";

export function PublicCardClient({ card }: { card: CardData }) {
  const language = toCardLanguage(card.language);
  const dir = cardDir(language);
  const t = cardStrings(language);

  const [leadState, setLeadState] = useState<"idle" | "sending" | "success" | "error">("idle");
  // QA-008: שגיאות ברמת שדה, ומונה שמפעיל מיקוד אחרי הרינדור.
  const [leadErrors, setLeadErrors] = useState<Record<string, string>>({});
  const [leadServerError, setLeadServerError] = useState("");
  const [focusLeadSummary, setFocusLeadSummary] = useState(0);

  useEffect(() => {
    if (focusLeadSummary > 0) focusErrorSummary();
  }, [focusLeadSummary]);
  // רק שדות שבעל הכרטיס בחר להציג. מוסתר אינו מרונדר ואינו נשלח.
  const shownFields = visibleFields(card.contactFormFields);

  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState("");

  function track(type: string) {
    // מדידה פנימית היא קטגוריית אנליטיקה. בלי הסכמה — אין איסוף כלל.
    if (!hasConsent("analytics")) return;
    const body = JSON.stringify({ slug: card.slug, type, referrer: document.referrer || undefined });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  }

  useEffect(() => {
    let tracked = false;
    const recordView = () => { if (!tracked && hasConsent("analytics")) { tracked = true; track(new URLSearchParams(location.search).get("src") === "qr" ? "qr_scan" : "view"); } };
    recordView();
    const listener = (event: Event) => { if ((event as CustomEvent<ConsentState>).detail?.analytics) recordView(); };
    window.addEventListener(CONSENT_EVENT, listener);
    return () => window.removeEventListener(CONSENT_EVENT, listener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function share() {
    track("share");
    if (navigator.share) await navigator.share({ title: card.seoTitle || card.ownerName, text: card.seoDescription || card.bio, url: location.href });
    else await navigator.clipboard.writeText(location.href);
  }

  useEffect(() => {
    if (!showQr || qrData) return;
    const qrUrl = new URL(location.href); qrUrl.searchParams.set("src", "qr");
    QRCode.toDataURL(qrUrl.toString(), { width: 440, margin: 2, color: { dark: card.primaryColor, light: "#ffffff" } }).then(setQrData).catch(() => setQrData(""));
  }, [showQr, qrData, card.primaryColor]);

  /**
   * ולידציה בצד לקוח לפני שליחה.
   *
   * QA-008: הטופס נשען על required של הדפדפן בלבד — הודעה באנגלית,
   * בלי aria-invalid, בלי קישור בין השדה להסבר ובלי סיכום שגיאות.
   * noValidate מבטל את ההתנהגות הזו, ולכן הוולידציה כאן היא תנאי
   * לכך שהטופס יישאר שמיש. השרת מאמת שוב בכל מקרה.
   */
  function validateLead(formData: FormData): Record<string, string> {
    const found: Record<string, string> = {};

    for (const field of shownFields) {
      const key = `field_${field.id}`;
      const raw = field.type === "checkbox" ? formData.get(key) === "on" : String(formData.get(key) || "").trim();

      if (field.required && (raw === "" || raw === false)) {
        found[key] = t.requiredField(field.label);
        continue;
      }
      if (typeof raw !== "string" || !raw) continue;

      if (field.type === "email" && !isEmailLike(raw)) {
        found[key] = t.invalidEmail(field.label);
      }
      // countDigits ולא replace עם מחלקת תווים: /D/ במקום /\D/ ספר כאן
      // מקפים ורווחים כספרות, ו-"1-2-3-4-5" עבר כמספר טלפון תקין.
      if (field.type === "tel" && countDigits(raw) < 9) {
        found[key] = t.invalidPhone(field.label);
      }
    }

    if (formData.get("privacyConsent") !== "on") {
      found.privacyConsent = t.privacyConsent;
    }
    return found;
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const found = validateLead(formData);
    setLeadErrors(found);
    if (Object.keys(found).length) {
      setLeadState("idle");
      setFocusLeadSummary((count) => count + 1);
      return;
    }

    setLeadState("sending");
    const fields: Record<string, string | boolean> = {};
    shownFields.forEach((field) => { const key = `field_${field.id}`; fields[field.label] = field.type === "checkbox" ? formData.get(key) === "on" : String(formData.get(key) || ""); });
    const first = (predicate: (field: ContactFormField) => boolean) => { const field = shownFields.find(predicate); return field ? String(formData.get(`field_${field.id}`) || "") : ""; };
    const name = first((field) => field.label.includes("שם")) || first((field) => field.type === "text") || "ללא שם";
    const phone = first((field) => field.type === "tel");
    const email = first((field) => field.type === "email");
    const message = first((field) => field.type === "textarea");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: card.slug, name, phone, email, message, fields, [HONEYPOT_FIELD]: formData.get(HONEYPOT_FIELD) }),
      });
      if (response.ok) {
        setLeadState("success");
        form.reset();
        return;
      }
      // REQ-001: כשל אינו מאפס את הטופס — מה שהוקלד נשאר.
      const result = await response.json().catch(() => null);
      setLeadState("error");
      setLeadServerError(result?.error || "");
      setFocusLeadSummary((count) => count + 1);
    } catch {
      setLeadState("error");
      setLeadServerError("");
      setFocusLeadSummary((count) => count + 1);
    }
  }

  const contactForm = leadState === "success"
    ? <div className="flex items-center gap-3 rounded-2xl bg-[#ecfbf6] p-5 text-[#08735f]"><span className="grid h-10 w-10 place-items-center rounded-full bg-white"><Check size={20} /></span><span><strong className="block">{t.sentTitle}</strong><span className="text-sm">{card.contactFormSuccessMessage}</span></span></div>
    : <div><h2 className="text-xl font-black">{card.contactFormTitle}</h2><p className="mt-1 text-sm text-[#6a778c]">{t.formIntro(card.businessName)}</p><form className="mt-5 grid gap-3" method="post" action="/api/leads" noValidate onSubmit={submitLead}><ErrorSummary errors={leadErrors} />{shownFields.map((field) => <DynamicField key={field.id} field={field} error={leadErrors[`field_${field.id}`]} t={t} />)}<label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input className="mt-1" name="privacyConsent" type="checkbox" data-field="privacyConsent" aria-required="true" aria-invalid={Boolean(leadErrors.privacyConsent)} aria-describedby={leadErrors.privacyConsent ? "lead-consent-error" : undefined} /><span>{t.privacyConsentText(card.businessName)}<Link href="/legal/privacy" className="font-bold text-[#5134cc] underline">{t.privacyConsentLink}</Link>. <span className="required-field">{t.requiredMark}</span>{leadErrors.privacyConsent && <span id="lead-consent-error" className="mt-1 block text-xs font-bold text-[#b7293a]">{leadErrors.privacyConsent}</span>}</span></label><div aria-hidden="true" className="sr-only"><input {...honeypotInputProps} aria-label="" /></div>{leadState === "error" && <p role="alert" className="text-sm text-[#b7293a]">{leadServerError || t.genericError}</p>}<button className="button-primary w-full" type="submit" disabled={leadState === "sending"} style={{ background: card.primaryColor, borderColor: card.primaryColor }}>{leadState === "sending" && <Loader2 size={18} className="animate-spin" />}{leadState === "sending" ? t.sending : t.submit}</button></form></div>;


  /*
   * QA-035: השפה והכיוון מוצהרים על עטיפת הכרטיס ולא על המסמך כולו.
   * הכרטיס הציבורי עשוי להיות באנגלית בעוד שאר האתר בעברית, וכיוון
   * שגוי הופך טקסט עם מספרים וסימני פיסוק לבלתי קריא.
   */
  return <div lang={language} dir={dir} className="min-h-screen" style={{ "--public-primary": card.primaryColor, background: backgroundCss(card.backgroundPreset) } as React.CSSProperties}>
    <header className="mx-auto flex max-w-[660px] items-center justify-between px-4 py-5"><span className="rounded-xl bg-white/85 px-3 py-2 shadow-sm backdrop-blur"><Logo compact /></span><div className="flex gap-2"><button type="button" onClick={() => setShowQr(true)} className="button-secondary h-11 min-h-11 px-3" aria-label={t.qrAria}><QrCode size={18} /><span className="hidden sm:inline">{t.qr}</span></button><button type="button" onClick={share} className="button-secondary h-11 min-h-11 px-3" aria-label={t.shareAria}><Share2 size={18} /><span className="hidden sm:inline">{t.share}</span></button></div></header>
    <main className="mx-auto max-w-[620px] px-3 pb-10 sm:px-5"><div className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(11,24,48,.16)]"><CardPreview card={card} onAction={track} contactForm={contactForm} /></div></main>
    <footer className="pb-24 text-center text-xs text-[#758198]">{t.builtWith} <Logo compact /></footer>
    {/* REQ-024: נקודת פעולה אחת קבועה. ה-padding בפוטר מפנה לה מקום כדי שלא תכסה תוכן. */}
    <ContactFab card={card} onAction={track} />
    {showQr && <div className="fixed inset-0 z-50 grid place-items-center bg-[#071020]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t.qrTitle}><div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[28px] bg-white p-6 text-center shadow-2xl"><button type="button" onClick={() => setShowQr(false)} className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#f0f2f6]" aria-label={t.close}><X size={18} /></button><QrCode className="mx-auto text-[#6d4aff]" size={28} /><h2 className="mt-3 text-xl font-black">{t.qrTitle}</h2><p className="mt-1 text-sm text-[#6a778c]">{t.qrSubtitle}</p>{qrData ? <img src={qrData} alt={t.qrAlt(card.ownerName)} className="mx-auto mt-5 w-64 rounded-2xl border border-[#e1e5ec]" /> : <div className="mx-auto mt-5 grid h-64 w-64 place-items-center rounded-2xl bg-[#f4f5f8]"><Loader2 className="animate-spin" /></div>}{qrData && <a href={qrData} download={`${card.slug}-qr.png`} className="button-primary mt-5 w-full"><Download size={18} />{t.qrDownload}</a>}</div></div>}
  </div>;
}

function FieldLabel({ field, t }: { field: ContactFormField; t: CardStrings }) { return <span>{field.label}{field.required && <span className="required-field">{t.requiredMark}</span>}</span>; }

function DynamicField({ field, error, t }: { field: ContactFormField; error?: string; t: CardStrings }) {
  const name = `field_${field.id}`;
  const errorId = `${name}-error`;
  // QA-008: כל שדה שנכשל מסומן ומקושר להסבר שלו.
  const a11y = {
    "data-field": name,
    "aria-required": field.required,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
  } as const;
  const message = error ? <span id={errorId} role="alert" className="mt-1 block text-xs font-bold text-[#b7293a]">{error}</span> : null;
  if (field.type === "checkbox") return <label className="flex min-h-11 items-center gap-2 text-sm"><input name={name} type="checkbox" {...a11y} /><FieldLabel field={field} t={t} />{message}</label>;
  if (field.type === "textarea") return <label className="field-label"><FieldLabel field={field} t={t} /><textarea className="field-textarea" name={name} placeholder={field.placeholder || undefined} {...a11y} maxLength={2000} />{message}</label>;
  if (field.type === "select") return <label className="field-label"><FieldLabel field={field} t={t} /><select className="field-select" name={name} {...a11y}><option value="">{t.selectPlaceholder}</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select>{message}</label>;
  return <label className="field-label"><FieldLabel field={field} t={t} /><input className="field-input" name={name} type={field.type} placeholder={field.placeholder || undefined} {...a11y} autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : undefined} />{message}</label>;
}
