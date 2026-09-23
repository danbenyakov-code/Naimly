"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Copy, FileCheck2, KeyRound, Loader2, Send, ShieldCheck, UserPlus, X } from "lucide-react";
import type { AdminCustomer, PaymentRequestRecord } from "@/lib/admin-data";
import type { PlanId } from "@/lib/types";
import { planName } from "@/lib/plan-access";
import { cycleMonths, LEGAL_VERSION_LABEL } from "@/lib/admin-labels";
import { cn, formatCurrency } from "@/lib/utils";
import { burst } from "@/lib/celebrate";
import { purchaseStatusLabels, type PurchaseStatus } from "@/lib/purchase-workflow";

type Tab = "payments" | "customers" | "create";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const statusTone: Record<PurchaseStatus, string> = {
  pending_admin_review: "bg-[#fff8e8] text-[#805100]",
  awaiting_payment_link: "bg-[#fff8e8] text-[#805100]",
  payment_link_sent: "bg-[#eef2ff] text-[#3b4ea3]",
  customer_reported_paid: "bg-[#eef2ff] text-[#3b4ea3]",
  payment_verification: "bg-[#eef2ff] text-[#3b4ea3]",
  paid_pending_activation: "bg-[#f1efff] text-[#4b3bad]",
  active: "bg-[#e9fbf7] text-[#08735f]",
  rejected: "bg-[#fff2f4] text-[#a32031]",
  cancelled: "bg-[#f2f4f8] text-[#5f6d83]",
  expired: "bg-[#f2f4f8] text-[#5f6d83]",
  refunded: "bg-[#fff2f4] text-[#a32031]",
};

const STATUS_GROUPS: Array<{ key: string; label: string; statuses: PurchaseStatus[] }> = [
  { key: "new", label: "בקשות חדשות", statuses: ["pending_admin_review"] },
  { key: "link", label: "ממתינות לשליחת קישור", statuses: ["awaiting_payment_link"] },
  { key: "waiting_payment", label: "ממתינות לתשלום", statuses: ["payment_link_sent"] },
  { key: "reported", label: "לקוחות שדיווחו ששילמו", statuses: ["customer_reported_paid"] },
  { key: "verifying", label: "תשלומים בבדיקה", statuses: ["payment_verification"] },
  { key: "activation", label: "ממתינות להפעלה", statuses: ["paid_pending_activation"] },
  { key: "active", label: "עסקאות פעילות", statuses: ["active"] },
  { key: "closed", label: "נדחו או בוטלו", statuses: ["rejected", "cancelled", "expired"] },
];

/** תוצאה שמוצגת פעם אחת: סיסמה או קישור כניסה שיש לשלוח ללקוח. */
type Credentials = { email: string; password?: string; message: string; whatsappUrl: string; actionLink?: string };

export function PaymentsBoard({ requests, customers, demo }: { requests: PaymentRequestRecord[]; customers: AdminCustomer[]; demo: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("payments");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "">("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ request: PaymentRequestRecord; action: "activate" | "reject" | "cancel"; title: string; impact: string } | null>(null);
  const [verifyOpenFor, setVerifyOpenFor] = useState<string>("");
  const [paymentReferenceInput, setPaymentReferenceInput] = useState("");

  const filtered = useMemo(() => {
    return requests.filter((request) => {
      if (statusFilter && request.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const needle = search.trim().toLowerCase();
      return (
        request.reference.toLowerCase().includes(needle) ||
        request.customerEmail.toLowerCase().includes(needle) ||
        request.customerName.toLowerCase().includes(needle)
      );
    });
  }, [requests, statusFilter, search]);

  const summary = useMemo(() => {
    const pendingAmount = requests
      .filter((request) => !["active", "rejected", "cancelled", "refunded"].includes(request.status))
      .reduce((sum, request) => sum + request.amount, 0);
    const now = new Date();
    const approvedThisMonth = requests
      .filter((request) => request.status === "active" && request.activatedAt && new Date(request.activatedAt).getMonth() === now.getMonth() && new Date(request.activatedAt).getFullYear() === now.getFullYear())
      .reduce((sum, request) => sum + request.amount, 0);
    return { pendingAmount, approvedThisMonth };
  }, [requests]);

  async function call(url: string, body: unknown, key: string, method: "POST" | "PATCH" = "POST") {
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

  async function runAction(request: PaymentRequestRecord, action: string, extra: Record<string, unknown> = {}) {
    const result = await call(`/api/admin/payment-requests/${request.id}`, { action, ...extra }, `${request.id}:${action}`);
    if (!result) return;
    if (action === "activate") burst(undefined, { count: 80 });
    const trimmed = Array.isArray(result.trimmed) && result.trimmed.length ? ` הכרטיס הותאם למסלול: ${result.trimmed.join(", ")}.` : "";
    const messages: Record<string, string> = {
      approve_in_principle: `הבקשה של ${request.customerName} אושרה עקרונית.`,
      send_payment_link: `קישור תשלום נשלח ל-${request.customerName}.`,
      resend_payment_link: `קישור התשלום נשלח שוב ל-${request.customerName}.`,
      verify_payment: `התשלום של ${request.customerName} אומת — ממתין להפעלה.`,
      activate: `המסלול הופעל עבור ${request.customerName}.${trimmed}`,
      reject: `הבקשה של ${request.customerName} נדחתה.`,
      cancel: `הבקשה של ${request.customerName} בוטלה.`,
    };
    setNotice(messages[action] || "הפעולה בוצעה.");
    setConfirm(null);
    setVerifyOpenFor("");
    setPaymentReferenceInput("");
    router.refresh();
  }

  async function sendCredentials(customer: AdminCustomer) {
    const result = await call("/api/admin/users", { userId: customer.id, mode: "reset_password", phone: customer.phone }, customer.id, "PATCH");
    if (!result) return;
    setCredentials({ email: customer.email, message: result.message, whatsappUrl: result.whatsappUrl, actionLink: result.actionLink });
    router.refresh();
  }

  async function toggleLock(customer: AdminCustomer) {
    const locked = !customer.adminLocked;
    let reason = "";
    if (locked) {
      reason = window.prompt(`סיבת הנעילה של ${customer.name} (חובה — למשל: אי-תשלום, חיוב שהתהפך, הפרת תנאים):`) || "";
      if (!reason.trim()) return;
    }
    const result = await call(`/api/admin/customers/${customer.id}/lock`, { locked, reason }, `lock:${customer.id}`, "POST");
    if (!result) return;
    setNotice(locked ? `${customer.name} ננעל. הגישה נחסמת מיידית.` : `${customer.name} שוחרר מנעילה.`);
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
    { id: "payments", label: "תשלומים", badge: requests.filter((request) => !["active", "rejected", "cancelled", "refunded"].includes(request.status)).length },
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
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          impact={confirm.impact}
          busy={busy === `${confirm.request.id}:${confirm.action}`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => runAction(confirm.request, confirm.action)}
        />
      )}

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

      {tab === "payments" && (
        <div className="grid gap-4">
          {/* כרטיסי סיכום */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_GROUPS.map((group) => {
              const count = requests.filter((request) => group.statuses.includes(request.status)).length;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === group.statuses[0] ? "" : group.statuses[0])}
                  className={cn(
                    "card-surface p-3.5 text-right transition",
                    statusFilter && group.statuses.includes(statusFilter) ? "ring-2 ring-[#6d4aff]" : "",
                  )}
                >
                  <strong className="block text-2xl">{count}</strong>
                  <span className="mt-0.5 block text-xs text-[#7d8899]">{group.label}</span>
                </button>
              );
            })}
            <div className="card-surface p-3.5">
              <strong className="block text-2xl">{formatCurrency(summary.pendingAmount)}</strong>
              <span className="mt-0.5 block text-xs text-[#7d8899]">סכום עסקאות ממתינות</span>
            </div>
            <div className="card-surface p-3.5">
              <strong className="block text-2xl">{formatCurrency(summary.approvedThisMonth)}</strong>
              <span className="mt-0.5 block text-xs text-[#7d8899]">אושרו החודש</span>
            </div>
          </div>

          {/* סינון */}
          <div className="flex flex-wrap items-center gap-2">
            <select className="field-select min-h-11 w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PurchaseStatus | "")}>
              <option value="">כל הסטטוסים</option>
              {Object.entries(purchaseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input
              className="field-input min-h-11 max-w-xs flex-1"
              placeholder="חיפוש לפי אסמכתא, שם או אימייל"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {(statusFilter || search) && (
              <button type="button" className="text-sm font-bold text-[#6d4aff]" onClick={() => { setStatusFilter(""); setSearch(""); }}>איפוס סינון</button>
            )}
          </div>

          {filtered.length === 0 && (
            <div className="card-surface grid min-h-40 place-items-center p-6 text-center">
              <div>
                <Check size={28} className="mx-auto text-[#0a9b81]" />
                <p className="mt-2 text-sm text-[#718096]">אין עסקאות התואמות את הסינון.</p>
              </div>
            </div>
          )}

          {filtered.map((request) => (
            <PaymentRow
              key={request.id}
              request={request}
              busy={busy}
              verifyOpen={verifyOpenFor === request.id}
              paymentReferenceInput={paymentReferenceInput}
              onSetPaymentReference={setPaymentReferenceInput}
              onToggleVerify={() => { setVerifyOpenFor(verifyOpenFor === request.id ? "" : request.id); setPaymentReferenceInput(""); }}
              onAction={(action, extra) => runAction(request, action, extra)}
              onConfirmAction={(action, title, impact) => setConfirm({ request, action, title, impact })}
            />
          ))}
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
                  {customer.adminLocked && <span className="rounded-full bg-[#fff2f4] px-2.5 py-1 text-xs font-bold text-[#a32031]">נעול</span>}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <Detail label="הצטרף" value={formatDate(customer.joinedAt)} />
                <Detail label="בתוקף עד" value={formatDate(customer.periodEnd)} />
                <Detail label="פרטי כניסה נשלחו" value={formatDate(customer.credentialsSentAt)} />
              </dl>

              {customer.adminLocked && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm leading-6 text-[#a32031]">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  נעול על ידי מנהל ב-{formatDate(customer.adminLockedAt)}. סיבה: {customer.adminLockedReason || "לא צוינה"}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={busy === `lock:${customer.id}` || demo} onClick={() => toggleLock(customer)} className={cn("min-h-12 flex-1", customer.adminLocked ? "button-primary" : "border border-[#f0bdc3] bg-white text-[#a32031] flex items-center justify-center gap-2 rounded-xl font-bold")}>
                  {busy === `lock:${customer.id}` ? <Loader2 size={17} className="animate-spin" /> : customer.adminLocked ? <ShieldCheck size={17} /> : <X size={17} />}
                  {customer.adminLocked ? "שחרור נעילה" : "נעילת חשבון"}
                </button>
                <button type="button" disabled={busy === customer.id || demo} onClick={() => sendCredentials(customer)} className="button-primary min-h-12 flex-1">
                  {busy === customer.id ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
                  שליחת קישור לקביעת סיסמה
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

function PaymentRow({
  request, busy, verifyOpen, paymentReferenceInput, onSetPaymentReference, onToggleVerify, onAction, onConfirmAction,
}: {
  request: PaymentRequestRecord;
  busy: string;
  verifyOpen: boolean;
  paymentReferenceInput: string;
  onSetPaymentReference: (value: string) => void;
  onToggleVerify: () => void;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
  onConfirmAction: (action: "activate" | "reject" | "cancel", title: string, impact: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isBusy = (action: string) => busy === `${request.id}:${action}`;

  return (
    <article className="card-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block">{request.customerName}</strong>
          <span className="block break-all text-xs text-[#7d8899]">{request.customerEmail}</span>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold", statusTone[request.status])}>{purchaseStatusLabels[request.status]}</span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="מסלול" value={request.planNameSnapshot || request.planId} />
        <Detail label="סכום" value={`${formatCurrency(request.amount)} · ${request.billingCycle === "annual" ? "שנתי" : "חודשי"}`} />
        <Detail label="מספר עסקה" value={request.reference} mono />
        <Detail label="נפתח" value={formatDate(request.createdAt)} />
        <Detail label="כרטיסים כלולים" value={String(request.cardsIncluded)} />
        <Detail label="טלפון" value={request.contactPhone || "לא נמסר"} mono />
        <Detail label="יופעל למשך" value={`${cycleMonths(request.billingCycle)} חודשים`} />
        <Detail label="אישור תנאים" value={request.termsAcceptedAt ? `${LEGAL_VERSION_LABEL(request.termsVersion)} · ${formatDate(request.termsAcceptedAt)}` : "לא תועד אישור"} />
      </dl>

      {!request.termsAcceptedAt && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#f1d69a] bg-[#fff8e8] p-3 text-sm leading-6 text-[#805100]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          לא נמצא תיעוד אישור תנאים ללקוח הזה. מומלץ לבדוק לפני אישור העסקה.
        </p>
      )}

      {request.note && <p className="mt-3 rounded-xl bg-[#f6f7fa] p-3 text-sm leading-6 text-[#5f6d83]">{request.note}</p>}

      <button type="button" onClick={() => setOpen((value) => !value)} className="mt-3 flex items-center gap-1 text-xs font-bold text-[#6d4aff]">
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        {open ? "הסתרת פרטים נוספים" : "פרטים נוספים והיסטוריה"}
      </button>
      {open && (
        <dl className="mt-2 grid gap-2 rounded-xl bg-[#f6f7fa] p-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="קישור תשלום נשלח" value={formatDate(request.paymentLinkSentAt)} />
          <Detail label="בתוקף עד" value={formatDate(request.paymentLinkExpiresAt)} />
          <Detail label="הלקוח דיווח ששילם" value={formatDate(request.customerReportedPaidAt)} />
          <Detail label="תשלום אומת" value={formatDate(request.paymentConfirmedAt)} />
          <Detail label="הופעל" value={formatDate(request.activatedAt)} />
          <Detail label="אסמכתת תשלום" value={request.paymentReference || "—"} mono />
          <Detail label="חשבונית" value={request.invoiceIssued ? `${request.invoiceReference || "הופקה"} · ${formatDate(request.invoiceIssuedAt)}` : "טרם הופקה"} />
          {request.customerNotes && <Detail label="הערת לקוח" value={request.customerNotes} />}
          {request.adminNote && <Detail label="הערת מנהל" value={request.adminNote} />}
        </dl>
      )}

      {verifyOpen && (
        <div className="mt-3 rounded-xl border border-[#dfe4ec] bg-white p-3">
          <label className="field-label">
            <span>אסמכתת תשלום (רשות)</span>
            <input className="field-input" dir="ltr" value={paymentReferenceInput} onChange={(event) => onSetPaymentReference(event.target.value)} placeholder="מספר אסמכתא מהביט" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={isBusy("verify_payment")} onClick={() => onAction("verify_payment", { paymentReference: paymentReferenceInput || undefined })} className="button-primary min-h-11 flex-1">
              {isBusy("verify_payment") ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}אישור קבלת תשלום
            </button>
            <button type="button" onClick={onToggleVerify} className="button-secondary min-h-11">ביטול</button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {request.status === "pending_admin_review" && (
          <>
            <ActionButton busy={isBusy("approve_in_principle")} onClick={() => onAction("approve_in_principle")} icon={<Check size={16} />} label="אישור עקרוני" primary />
            <ActionButton busy={false} onClick={() => onConfirmAction("reject", "דחיית הבקשה", `הבקשה של ${request.customerName} תסומן כנדחתה. אפשר יהיה ליצור בקשה חדשה בעתיד.`)} icon={<X size={16} />} label="דחייה" danger />
          </>
        )}
        {request.status === "awaiting_payment_link" && (
          <>
            <ActionButton busy={isBusy("send_payment_link")} onClick={() => onAction("send_payment_link")} icon={<Send size={16} />} label="שליחת קישור תשלום" primary />
            <ActionButton busy={false} onClick={() => onConfirmAction("reject", "דחיית הבקשה", `הבקשה של ${request.customerName} תסומן כנדחתה.`)} icon={<X size={16} />} label="דחייה" danger />
            <ActionButton busy={false} onClick={() => onConfirmAction("cancel", "ביטול הבקשה", `הבקשה של ${request.customerName} תסומן כמבוטלת.`)} icon={<X size={16} />} label="ביטול" />
          </>
        )}
        {request.status === "payment_link_sent" && (
          <>
            <ActionButton busy={isBusy("resend_payment_link")} onClick={() => onAction("resend_payment_link")} icon={<Send size={16} />} label="שליחה חוזרת" />
            <ActionButton busy={false} onClick={() => onConfirmAction("cancel", "ביטול הבקשה", `הבקשה של ${request.customerName} תסומן כמבוטלת. הקישור שנשלח יפסיק להיות רלוונטי.`)} icon={<X size={16} />} label="ביטול" />
          </>
        )}
        {(request.status === "customer_reported_paid" || request.status === "payment_verification") && !verifyOpen && (
          <>
            <ActionButton busy={false} onClick={onToggleVerify} icon={<ShieldCheck size={16} />} label="אישור קבלת תשלום" primary />
            <ActionButton busy={false} onClick={() => onConfirmAction("reject", "דחיית הבקשה", `הבקשה של ${request.customerName} תסומן כנדחתה — לשימוש כשהתשלום התברר כלא תקין.`)} icon={<X size={16} />} label="דחייה" danger />
          </>
        )}
        {request.status === "paid_pending_activation" && (
          <ActionButton
            busy={isBusy("activate")}
            onClick={() => onConfirmAction("activate", "הפעלת החבילה", `החבילה ${request.planNameSnapshot} תופעל בחשבונו של ${request.customerName} מיידית. הלקוח יקבל מייל אישור. אין דרך "לבטל" הפעלה — רק לבצע החזר בנפרד.`)}
            icon={<Check size={16} />}
            label="הפעלת החבילה"
            primary
          />
        )}
        {request.status === "active" && !request.invoiceIssued && (
          <ActionButton busy={isBusy("mark_invoice_issued")} onClick={() => onAction("mark_invoice_issued", { invoiceReference: window.prompt("מספר החשבונית/קבלה שהופקה ידנית:") || undefined })} icon={<FileCheck2 size={16} />} label="סימון שהופקה חשבונית" />
        )}
      </div>
    </article>
  );
}

function ActionButton({ busy, onClick, icon, label, primary = false, danger = false }: { busy: boolean; onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold",
        primary ? "button-primary" : danger ? "border border-[#f0bdc3] bg-white text-[#a32031]" : "button-secondary",
      )}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : icon}{label}
    </button>
  );
}

function ConfirmDialog({ title, impact, busy, onCancel, onConfirm }: { title: string; impact: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-extrabold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#5f6d83]">{impact}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" disabled={busy} onClick={onConfirm} className="button-primary min-h-12 flex-1">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}אישור
          </button>
          <button type="button" onClick={onCancel} className="button-secondary min-h-12 flex-1">ביטול</button>
        </div>
      </div>
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
        {credentials.password ? "הסיסמה מוצגת פעם אחת בלבד ואינה נשמרת. יש להעתיק ולשלוח כעת." : "הקישור חד־פעמי ובתוקף מוגבל."}
      </p>

      <div className="mt-3 grid gap-2">
        <CopyRow label="אימייל" value={credentials.email} onCopy={onCopy} />
        {credentials.password && <CopyRow label="סיסמה זמנית" value={credentials.password} onCopy={onCopy} mono />}
        {credentials.actionLink && <CopyRow label="קישור כניסה" value={credentials.actionLink} onCopy={onCopy} truncate />}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {credentials.whatsappUrl && (
          <a href={credentials.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button-primary min-h-12 flex-1">שליחה בוואטסאפ</a>
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
