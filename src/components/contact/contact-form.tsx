"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Send } from "lucide-react";
import { contactTopics, type ContactTopicId } from "@/lib/contact";
import { ErrorSummary, Field, focusErrorSummary, inputClass } from "@/components/ui/field";
import { burst } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

type FormState = { topic: ContactTopicId; name: string; email: string; phone: string; message: string };

const fieldOrder = ["topic", "name", "email", "message"];

export function ContactForm({ defaultTopic, supportEmail }: { defaultTopic?: string; supportEmail: string }) {
  const initialTopic = (contactTopics.find((topic) => topic.id === defaultTopic)?.id || "general") as ContactTopicId;
  const [form, setForm] = useState<FormState>({ topic: initialTopic, name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const successRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const activeTopic = contactTopics.find((topic) => topic.id === form.topic)!;

  function validate() {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "יש להזין שם מלא (לפחות 2 תווים)";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "כתובת האימייל אינה תקינה";
    if (form.message.trim().length < 10) next.message = "יש לפרט לפחות 10 תווים כדי שנוכל לעזור";
    if (form.phone && form.phone.replace(/\D/g, "").length < 9) next.phone = "מספר הטלפון אינו תקין";
    return next;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => focusErrorSummary());
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.field) setErrors({ [result.field]: result.error });
        else setServerError(result.error || "לא הצלחנו לשלוח את הפנייה");
        requestAnimationFrame(() => focusErrorSummary());
        return;
      }
      setSent(true);
      burst(submitRef.current, { count: 70 });
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setServerError("אין חיבור לרשת. אפשר לנסות שוב או לכתוב לנו במייל.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="card-surface p-6 text-center outline-none sm:p-10"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e9fbf7] text-[#08735f]">
          <Check size={32} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-black tracking-[-0.03em]">הפנייה נשלחה</h2>
        <p className="mt-2 leading-7 text-[#68758a]">
          קיבלנו את הפנייה בנושא <strong>{activeTopic.label}</strong> ונחזור אליך לכתובת{" "}
          <span dir="ltr" className="font-semibold">{form.email}</span>.
        </p>
        <p className="mt-1 text-sm text-[#8b96a8]">בדרך כלל אנחנו חוזרים תוך יום עסקים אחד.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="button-secondary min-h-12">חזרה לדף הבית</Link>
          <button
            type="button"
            className="button-primary min-h-12"
            onClick={() => { setSent(false); setForm({ ...form, message: "" }); }}
          >
            שליחת פנייה נוספת
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {(Object.keys(errors).length > 0 || serverError) && (
        <ErrorSummary
          errors={serverError ? { ...errors, _server: serverError } : errors}
          fieldOrder={[...fieldOrder, "phone", "_server"]}
        />
      )}

      {/* בחירת נושא — כרטיסים במקום select, כדי שיהיה ברור וקל למגע */}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[0.9rem] font-semibold">
          נושא הפנייה<span className="required-field">חובה</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {contactTopics.map((topic) => {
            const Icon = topic.icon;
            const active = form.topic === topic.id;
            return (
              <label
                key={topic.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition",
                  active ? "border-[#6d4aff] bg-[#f7f5ff] shadow-[0_0_0_3px_#eeeaff]" : "border-[#dfe4ec] bg-white hover:border-[#a99feb]",
                )}
              >
                <input
                  type="radio"
                  name="topic"
                  value={topic.id}
                  checked={active}
                  onChange={() => setForm({ ...form, topic: topic.id })}
                  className="sr-only"
                />
                <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-[#6d4aff] text-white" : "bg-[#f1f3f7] text-[#6d4aff]")}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{topic.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#78859a]">{topic.description}</span>
                </span>
                {active && <Check size={17} className="mt-1 shrink-0 text-[#6d4aff]" aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם מלא" required error={errors.name}>
          {(field) => (
            <input
              {...field}
              className={inputClass(Boolean(errors.name))}
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={80}
            />
          )}
        </Field>

        <Field label="אימייל" required error={errors.email} hint="לכתובת הזו נחזור אליך">
          {(field) => (
            <input
              {...field}
              className={inputClass(Boolean(errors.email))}
              name="email"
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              maxLength={160}
            />
          )}
        </Field>
      </div>

      <Field label="טלפון" optional error={errors.phone} hint="אם נוח לך שנחזור בוואטסאפ">
        {(field) => (
          <input
            {...field}
            className={inputClass(Boolean(errors.phone))}
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            maxLength={30}
          />
        )}
      </Field>

      <Field label="פירוט הפנייה" required error={errors.message} hint={`${form.message.length}/2000 תווים`}>
        {(field) => (
          <textarea
            {...field}
            className={inputClass(Boolean(errors.message), "field-textarea")}
            name="message"
            rows={6}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder={activeTopic.placeholder}
            maxLength={2000}
          />
        )}
      </Field>

      {/* מלכודת ספאם — מוסתרת מהמשתמש ומקורא המסך */}
      <div aria-hidden="true" className="sr-only">
        <label>חברה<input name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[#8b96a8]">
          אפשר גם ישירות למייל{" "}
          <a href={`mailto:${supportEmail}`} className="font-semibold text-[#6d4aff] underline underline-offset-2" dir="ltr">
            {supportEmail}
          </a>
        </p>
        <button ref={submitRef} type="submit" disabled={sending} className="button-primary min-h-13 w-full sm:w-auto">
          {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          {sending ? "שולחים..." : "שליחת הפנייה"}
          {!sending && <ArrowLeft size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
