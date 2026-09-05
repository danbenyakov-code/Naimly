"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, QrCode, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { CardPreview } from "@/components/card/card-preview";
import { Logo } from "@/components/logo";
import type { CardData, ContactFormField } from "@/lib/types";

export function PublicCardClient({ card }: { card: CardData }) {
  const [leadState, setLeadState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState("");

  function track(type: string) {
    if (localStorage.getItem("cookie-consent") !== "accepted") return;
    const body = JSON.stringify({ slug: card.slug, type, referrer: document.referrer || undefined });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  }

  useEffect(() => {
    let tracked = false;
    const recordView = () => { if (!tracked && localStorage.getItem("cookie-consent") === "accepted") { tracked = true; track(new URLSearchParams(location.search).get("src") === "qr" ? "qr_scan" : "view"); } };
    recordView();
    const listener = (event: Event) => { if ((event as CustomEvent<string>).detail === "accepted") recordView(); };
    window.addEventListener("cookie-consent", listener);
    return () => window.removeEventListener("cookie-consent", listener);
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

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLeadState("sending");
    const form = event.currentTarget; const formData = new FormData(form);
    const fields: Record<string, string | boolean> = {};
    card.contactFormFields.forEach((field) => { const key = `field_${field.id}`; fields[field.label] = field.type === "checkbox" ? formData.get(key) === "on" : String(formData.get(key) || ""); });
    const first = (predicate: (field: ContactFormField) => boolean) => { const field = card.contactFormFields.find(predicate); return field ? String(formData.get(`field_${field.id}`) || "") : ""; };
    const name = first((field) => field.label.includes("שם")) || first((field) => field.type === "text") || "ללא שם";
    const phone = first((field) => field.type === "tel");
    const email = first((field) => field.type === "email");
    const message = first((field) => field.type === "textarea");
    const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: card.slug, name, phone, email, message, fields, website: formData.get("website") }) });
    if (response.ok) { setLeadState("success"); form.reset(); } else setLeadState("error");
  }

  const contactForm = leadState === "success"
    ? <div className="flex items-center gap-3 rounded-2xl bg-[#ecfbf6] p-5 text-[#08735f]"><span className="grid h-10 w-10 place-items-center rounded-full bg-white"><Check size={20} /></span><span><strong className="block">הפנייה נשלחה</strong><span className="text-sm">{card.contactFormSuccessMessage}</span></span></div>
    : <div><h2 className="text-xl font-black">{card.contactFormTitle}</h2><p className="mt-1 text-sm text-[#6a778c]">הפרטים יגיעו ישירות ל־{card.businessName}. שדות המסומנים „חובה” נדרשים לשליחה.</p><form className="mt-5 grid gap-3" onSubmit={submitLead}>{card.contactFormFields.map((field) => <DynamicField key={field.id} field={field} />)}<label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input className="mt-1" name="privacyConsent" type="checkbox" required aria-required="true" /><span>אני מאשר/ת להעביר את הפרטים ל־{card.businessName} לצורך מענה לפנייה, בהתאם ל<Link href="/legal/privacy" className="font-bold text-[#5134cc] underline">מדיניות הפרטיות</Link>. <span className="required-field">חובה</span></span></label><label className="sr-only">אתר<input name="website" tabIndex={-1} autoComplete="off" /></label>{leadState === "error" && <p role="alert" className="text-sm text-[#b7293a]">לא הצלחנו לשלוח כרגע. אפשר ליצור קשר באמצעות הכפתורים למעלה.</p>}<button className="button-primary w-full" type="submit" disabled={leadState === "sending"} style={{ background: card.primaryColor, borderColor: card.primaryColor }}>{leadState === "sending" && <Loader2 size={18} className="animate-spin" />}{leadState === "sending" ? "שולחים..." : "שליחת פנייה"}</button></form></div>;

  const backgrounds: Record<CardData["backgroundPreset"], string> = {
    aurora: "radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--public-primary) 18%,transparent),transparent 32%),#eef1f6",
    paper: "linear-gradient(135deg,#fffdf7,#eee9df)", sunset: "linear-gradient(135deg,#ffe0d5,#eddcff 55%,#d7f3ff)",
    ocean: "radial-gradient(circle at 15% 10%,#1a9aae,transparent 35%),linear-gradient(145deg,#06172b,#12384a)",
    midnight: "radial-gradient(circle at 85% 10%,#4c3f91,transparent 38%),linear-gradient(145deg,#0d1323,#252044)",
    minimal: "radial-gradient(circle at 15% 15%,#ffd7f1,transparent 35%),radial-gradient(circle at 85% 25%,#c5edff,transparent 40%),radial-gradient(circle at 50% 90%,#ddd2ff,transparent 45%),#f5f2ff",
  };

  return <div className="min-h-screen" style={{ "--public-primary": card.primaryColor, background: backgrounds[card.backgroundPreset] } as React.CSSProperties}>
    <header className="mx-auto flex max-w-[660px] items-center justify-between px-4 py-5"><span className="rounded-xl bg-white/85 px-3 py-2 shadow-sm backdrop-blur"><Logo compact /></span><div className="flex gap-2"><button type="button" onClick={() => setShowQr(true)} className="button-secondary h-11 min-h-11 px-3" aria-label="הצגת QR"><QrCode size={18} /><span className="hidden sm:inline">QR</span></button><button type="button" onClick={share} className="button-secondary h-11 min-h-11 px-3" aria-label="שיתוף הכרטיס"><Share2 size={18} /><span className="hidden sm:inline">שיתוף</span></button></div></header>
    <main className="mx-auto max-w-[620px] px-3 pb-10 sm:px-5"><div className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(11,24,48,.16)]"><CardPreview card={card} onAction={track} contactForm={contactForm} /></div></main>
    <footer className="pb-8 text-center text-xs text-[#758198]">נבנה באמצעות <Logo compact /></footer>
    {showQr && <div className="fixed inset-0 z-50 grid place-items-center bg-[#071020]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="קוד QR לכרטיס"><div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[28px] bg-white p-6 text-center shadow-2xl"><button type="button" onClick={() => setShowQr(false)} className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#f0f2f6]" aria-label="סגירה"><X size={18} /></button><QrCode className="mx-auto text-[#6d4aff]" size={28} /><h2 className="mt-3 text-xl font-black">סרקו ושמרו את הכרטיס</h2><p className="mt-1 text-sm text-[#6a778c]">הקישור נשאר קבוע גם אחרי עדכון התוכן.</p>{qrData ? <img src={qrData} alt={`QR לכרטיס של ${card.ownerName}`} className="mx-auto mt-5 w-64 rounded-2xl border border-[#e1e5ec]" /> : <div className="mx-auto mt-5 grid h-64 w-64 place-items-center rounded-2xl bg-[#f4f5f8]"><Loader2 className="animate-spin" /></div>}{qrData && <a href={qrData} download={`${card.slug}-qr.png`} className="button-primary mt-5 w-full"><Download size={18} />הורדת QR</a>}</div></div>}
  </div>;
}

function FieldLabel({ field }: { field: ContactFormField }) { return <span>{field.label}{field.required && <span className="required-field">חובה</span>}</span>; }

function DynamicField({ field }: { field: ContactFormField }) {
  const name = `field_${field.id}`;
  if (field.type === "checkbox") return <label className="flex min-h-11 items-center gap-2 text-sm"><input name={name} type="checkbox" required={field.required} aria-required={field.required} /><FieldLabel field={field} /></label>;
  if (field.type === "textarea") return <label className="field-label"><FieldLabel field={field} /><textarea className="field-textarea" name={name} required={field.required} aria-required={field.required} maxLength={2000} /></label>;
  if (field.type === "select") return <label className="field-label"><FieldLabel field={field} /><select className="field-select" name={name} required={field.required} aria-required={field.required}><option value="">בחירה</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label className="field-label"><FieldLabel field={field} /><input className="field-input" name={name} type={field.type} required={field.required} aria-required={field.required} autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : undefined} /></label>;
}
