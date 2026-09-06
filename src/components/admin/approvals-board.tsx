"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, MessageCircle, UserPlus, X } from "lucide-react";
import type { AdminCustomer, PaymentRequestRecord } from "@/lib/admin-data";
import type { PlanId } from "@/lib/types";
import { planName } from "@/lib/plan-access";
import { cn, formatCurrency } from "@/lib/utils";
import { burst } from "@/lib/celebrate";

type Tab = "pending" | "customers" | "create";

const statusLabels: Record<PaymentRequestRecord["status"], string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  canceled: "בוטל",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** תוצאה שמוצגת פעם אחת: סיסמה או קישור כניסה שיש לשלוח ללקוח. */
type Credentials = { email: string; password?: string; message: string; whatsappUrl: string; actionLink?: string };

export function ApprovalsBoard({ requests, customers, demo }: { requests: PaymentRequestRecord[]; customers: AdminCustomer[]; demo: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const pending = requests.filter((request) => request.status === "pending");
  const handled = requests.filter((request) => request.status !== "pending");

  async function call(url: string, method: string, body: unknown, key: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "הפעולה נכשלה");
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function review(request: PaymentRequestRecord, action: "approve" | "reject") {
    const result = await call(`/api/admin/payment-requests/${request.id}`, "POST", { action, months: 1 }, request.id);
    if (!result) return;
    if (action === "approve") burst(undefined, { count: 80 });
    const trimmed = Array.isArray(result.trimmed) && result.trimmed.length ? ` הכרטיס הותאם למסלול: ${result.trimmed.join(", ")}.` : "";
    setNotice(action === "approve" ? `המסלול הופעל עבור ${request.customerName}.${trimmed}` : `הבקשה של ${request.customerName} נדחתה.`);
    router.refresh();
  }

  async function sendCredentials(customer: AdminCustomer, mode: "magic_link" | "reset_password") {
    const result = await call("/api/admin/users", "PATCH", { userId: customer.id, mode, phone: customer.phone }, customer.id);
    if (!result) return;
    setCredentials({ email: customer.email, message: result.message, whatsappUrl: result.whatsappUrl, actionLink: result.actionLink });
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("הועתק ללוח");
    } catch {
      setError("לא הצלחנו להעתיק");
    }
  }

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: "pending", label: "ממתינים לאישור", badge: pending.length },
    { id: "customers", label: "לקוחות" },
    { id: "create", label: "פתיחת חשבון" },
  ];

  return (
    <div className="mt-6">
      {demo && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-[#d8d0ff] bg-[#f3f0ff] p-4 text-sm leading-6 text-[#4636a6]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          מצב הדגמה: הנתונים לדוגמה בלבד ופעולות הניהול חסומות. לאחר חיבור Supabase המסך פעיל במלואו.
        </p>
      )}
      {error && <p role="alert" className="mb-4 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{notice}</p>}

      {credentials && <CredentialsPanel credentials={credentials} onCopy={copy} onClose={() => setCredentials(null)} />}

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold",
              tab === item.id ? "border-[#6d4aff] bg-[#f1efff] text-[#4b3bad]" : "border-[#dfe4ec] bg-white text-[#68758a]",
            )}
          >
            {item.label}
            {item.badge ? <span className="rounded-full bg-[#ffe9e9] px-1.5 text-[11px] text-[#a32031]">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="grid gap-3">
          {pending.length === 0 && (
            <div className="card-surface grid min-h-48 place-items-center p-6 text-center">
              <div>
                <Check size={32} className="mx-auto text-[#0a9b81]" />
                <h2 className="mt-3 text-lg font-extrabold">אין בקשות ממתינות</h2>
                <p className="mt-1 text-sm text-[#718096]">כל בקשות התשלום טופלו.</p>
              </div>
            </div>
          )}
          {pending.map((request) => (
            <article key={request.id} className="card-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block">{request.customerName}</strong>
                  <span className="block break-all text-xs text-[#7d8899]">{request.customerEmail}</span>
                </div>
                <span className="shrink-0 rounded-full bg-[#fff8e8] px-3 py-1 text-xs font-bold text-[#805100]">{statusLabels[request.status]}</span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="מסלול" value={planName(request.planId)} />
                <Detail label="סכום" value={formatCurrency(request.amount)} />
                <Detail label="אסמכתא" value={request.reference} mono />
                <Detail label="נפתח" value={formatDate(request.createdAt)} />
              </dl>

              {request.note && <p className="mt-3 rounded-xl bg-[#f6f7fa] p-3 text-sm leading-6 text-[#5f6d83]">{request.note}</p>}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy === request.id || demo}
                  onClick={() => review(request, "approve")}
                  className="button-primary min-h-12 flex-1"
                >
                  {busy === request.id ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}אישור והפעלת מסלול
                </button>
                <button
                  type="button"
                  disabled={busy === request.id || demo}
                  onClick={() => review(request, "reject")}
                  className="button-secondary min-h-12 flex-1 text-[#a73342] sm:flex-none"
                >
                  <X size={17} />דחייה
                </button>
                {request.contactPhone && (
                  <a
                    href={`https://wa.me/${request.contactPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button-secondary min-h-12 flex-1 sm:flex-none"
                  >
                    <MessageCircle size={17} />וואטסאפ
                  </a>
                )}
              </div>
            </article>
          ))}

          {handled.length > 0 && (
            <details className="card-surface p-4">
              <summary className="cursor-pointer text-sm font-bold">בקשות שטופלו ({handled.length})</summary>
              <ul className="mt-3 grid gap-2">
                {handled.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f6f7fa] p-3 text-sm">
                    <span className="min-w-0"><strong>{request.customerName}</strong> · {planName(request.planId)}</span>
                    <span className={cn("shrink-0 text-xs font-bold", request.status === "approved" ? "text-[#08735f]" : "text-[#a73342]")}>
                      {statusLabels[request.status]} · {formatDate(request.reviewedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {tab === "customers" && (
        <div className="grid gap-3">
          {customers.map((customer) => (
            <article key={customer.id} className="card-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block">{customer.name}</strong>
                  <span className="block break-all text-xs text-[#7d8899]">{customer.email}</span>
                  {customer.phone && <span dir="ltr" className="block text-right text-xs text-[#7d8899]">{customer.phone}</span>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-bold text-[#5141b6]">{planName(customer.plan)}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", customer.status === "active" ? "bg-[#e9fbf7] text-[#08735f]" : "bg-[#fff8e8] text-[#805100]")}>
                    {customer.status === "active" ? "פעיל" : customer.status === "trialing" ? "התנסות" : customer.status}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <Detail label="הצטרף" value={formatDate(customer.joinedAt)} />
                <Detail label="בתוקף עד" value={formatDate(customer.periodEnd)} />
                <Detail label="פרטי כניסה נשלחו" value={formatDate(customer.credentialsSentAt)} />
              </dl>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy === customer.id || demo}
                  onClick={() => sendCredentials(customer, "magic_link")}
                  className="button-primary min-h-12 flex-1"
                >
                  {busy === customer.id ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}קישור כניסה
                </button>
                <button
                  type="button"
                  disabled={busy === customer.id || demo}
                  onClick={() => sendCredentials(customer, "reset_password")}
                  className="button-secondary min-h-12 flex-1"
                >
                  איפוס סיסמה
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "create" && <CreateUserForm demo={demo} onCreated={(result) => { setCredentials(result); router.refresh(); }} />}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#8b96a8]">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-semibold", mono && "font-mono tracking-wide")} dir={mono ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}

function CredentialsPanel({ credentials, onCopy, onClose }: { credentials: Credentials; onCopy: (text: string) => void; onClose: () => void }) {
  return (
    <div className="mb-4 rounded-2xl border border-[#b7e6d8] bg-[#effcf8] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-extrabold text-[#08735f]">פרטי כניסה מוכנים לשליחה</p>
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#5f6d83]" aria-label="סגירה"><X size={17} /></button>
      </div>
      <p className="mt-1 text-xs text-[#0b6353]">
        {credentials.password
          ? "הסיסמה מוצגת פעם אחת בלבד ואינה נשמרת. יש להעתיק ולשלוח כעת."
          : "הקישור חד־פעמי ובתוקף מוגבל."}
      </p>

      <div className="mt-3 grid gap-2">
        <CopyRow label="אימייל" value={credentials.email} onCopy={onCopy} />
        {credentials.password && <CopyRow label="סיסמה זמנית" value={credentials.password} onCopy={onCopy} mono />}
        {credentials.actionLink && <CopyRow label="קישור כניסה" value={credentials.actionLink} onCopy={onCopy} truncate />}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {credentials.whatsappUrl && (
          <a href={credentials.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button-primary min-h-12 flex-1">
            <MessageCircle size={17} />שליחה בוואטסאפ
          </a>
        )}
        <button type="button" onClick={() => onCopy(credentials.message)} className="button-secondary min-h-12 flex-1">
          <Copy size={17} />העתקת ההודעה
        </button>
      </div>
    </div>
  );
}

function CopyRow({ label, value, onCopy, mono = false, truncate = false }: { label: string; value: string; onCopy: (text: string) => void; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white p-2.5">
      <span className="shrink-0 text-xs font-bold text-[#5f6d83]">{label}</span>
      <span dir="ltr" className={cn("min-w-0 flex-1 text-left text-sm", mono && "font-mono", truncate ? "truncate" : "break-all")}>{value}</span>
      <button type="button" onClick={() => onCopy(value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f0f2f6] text-[#5a677c]" aria-label={`העתקת ${label}`}>
        <Copy size={15} />
      </button>
    </div>
  );
}

function CreateUserForm({ demo, onCreated }: { demo: boolean; onCreated: (credentials: Credentials) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", planId: "trial" as PlanId, months: 1 });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "יצירת החשבון נכשלה");
      onCreated({ email: result.email, password: result.password, message: result.message, whatsappUrl: result.whatsappUrl });
      setForm({ fullName: "", email: "", phone: "", planId: "trial", months: 1 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-surface p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><UserPlus size={21} /></span>
        <div>
          <h2 className="font-extrabold">פתיחת חשבון ללקוח</h2>
          <p className="text-xs text-[#7d8899]">נוצרת סיסמה זמנית שתוצג פעם אחת לשליחה בוואטסאפ.</p>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          <span>שם מלא<span className="required-field">חובה</span></span>
          <input className="field-input" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required minLength={2} maxLength={80} autoComplete="name" />
        </label>
        <label className="field-label">
          <span>אימייל<span className="required-field">חובה</span></span>
          <input className="field-input" type="email" dir="ltr" inputMode="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
        </label>
        <label className="field-label">
          <span>טלפון לוואטסאפ</span>
          <input className="field-input" type="tel" dir="ltr" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={30} autoComplete="tel" />
        </label>
        <label className="field-label">
          <span>מסלול פתיחה</span>
          <select className="field-select" value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value as PlanId })}>
            <option value="trial">התנסות 14 יום</option>
            <option value="basic">בסיסי</option>
            <option value="pro">מקצועי</option>
            <option value="premium">פרימיום</option>
          </select>
        </label>
        {form.planId !== "trial" && (
          <label className="field-label">
            <span>מספר חודשים</span>
            <input className="field-input" type="number" min={1} max={24} value={form.months} onChange={(event) => setForm({ ...form, months: Number(event.target.value) || 1 })} />
          </label>
        )}
      </div>

      <button type="submit" disabled={busy || demo} className="button-primary mt-5 min-h-13 w-full sm:w-auto">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}יצירת חשבון ושליחת פרטים
      </button>
    </form>
  );
}
