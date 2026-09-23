import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { PlanId, Viewer } from "@/lib/types";
import { toBillingCycle, type BillingCycle } from "@/lib/config";
import { isPurchaseStatus, type PurchaseStatus } from "@/lib/purchase-workflow";

export type PaymentRequestRecord = {
  id: string;
  reference: string;
  userId: string;
  planId: Exclude<PlanId, "trial"> | "extra_card";
  amount: number;
  billingCycle: BillingCycle;
  method: string;
  status: PurchaseStatus;
  contactPhone: string;
  note: string;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  customerName: string;
  customerEmail: string;
  /** גרסת המסמכים שהלקוח אישר, ומתי. ראיה שהאישור ניתן לפני התשלום. */
  termsVersion: string;
  termsAcceptedAt: string | null;
  // ── snapshot ──────────────────────────────────────────────────────────
  planNameSnapshot: string;
  priceBeforeDiscount: number | null;
  discountAmount: number;
  currency: string;
  cardsIncluded: number;
  featuresSnapshot: string[];
  pricingVersion: string;
  // ── תשלום וחשבונית ────────────────────────────────────────────────────
  paymentLink: string | null;
  paymentLinkExpiresAt: string | null;
  paymentReference: string | null;
  invoiceIssued: boolean;
  invoiceReference: string | null;
  invoiceIssuedAt: string | null;
  invoiceNote: string;
  invoiceSentToCustomer: boolean;
  customerNotes: string;
  // ── חותמות זמן ────────────────────────────────────────────────────────
  paymentLinkSentAt: string | null;
  customerReportedPaidAt: string | null;
  paymentConfirmedAt: string | null;
  activatedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
};

export type PaymentRequestFilter = {
  status?: PurchaseStatus;
  planId?: string;
  billingCycle?: BillingCycle;
  email?: string;
  reference?: string;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: PlanId;
  status: string;
  trialEndsAt: string | null;
  periodEnd: string | null;
  joinedAt: string;
  approvedAt: string | null;
  credentialsSentAt: string | null;
  adminLocked: boolean;
  adminLockedAt: string | null;
  adminLockedReason: string;
};

const demoRequestBase = {
  method: "bit", note: "", adminNote: "", reviewedAt: null, termsVersion: "2026-09-14", termsAcceptedAt: "2026-09-05T08:19:00.000Z",
  priceBeforeDiscount: null, discountAmount: 0, currency: "ILS", featuresSnapshot: [] as string[], pricingVersion: "2026-09-23",
  paymentLink: null, paymentLinkExpiresAt: null, paymentReference: null,
  invoiceIssued: false, invoiceReference: null, invoiceIssuedAt: null, invoiceNote: "", invoiceSentToCustomer: false, customerNotes: "",
  paymentLinkSentAt: null, customerReportedPaidAt: null, paymentConfirmedAt: null, activatedAt: null, rejectedAt: null, cancelledAt: null, refundedAt: null,
} as const;

const demoRequests: PaymentRequestRecord[] = [
  { ...demoRequestBase, id: "pr1", reference: "PR-8F21C4-K3A9", userId: "u1", planId: "pro", amount: 49, billingCycle: "monthly", status: "pending_admin_review", contactPhone: "0521234567", note: "שילמתי בביט, מצרף צילום מסך בוואטסאפ", createdAt: "2026-09-05T08:20:00.000Z", customerName: "איתי ברק", customerEmail: "itay@example.com", planNameSnapshot: "מקצועי", cardsIncluded: 1 },
  { ...demoRequestBase, id: "pr2", reference: "BA-2D77A1-M8X2", userId: "u2", planId: "basic", amount: 290, billingCycle: "annual", status: "payment_link_sent", contactPhone: "0549876543", createdAt: "2026-09-04T16:05:00.000Z", customerName: "מאיה עזר", customerEmail: "maya@example.com", planNameSnapshot: "בסיסי", cardsIncluded: 1, paymentLink: "https://wa.me/000000000", paymentLinkSentAt: "2026-09-04T17:00:00.000Z" },
  { ...demoRequestBase, id: "pr3", reference: "PM-91BB03-Q1Z7", userId: "u3", planId: "premium", amount: 79, billingCycle: "monthly", status: "active", contactPhone: "0501112233", adminNote: "אושר לאחר אימות בביט", reviewedAt: "2026-09-02T12:10:00.000Z", createdAt: "2026-09-02T11:40:00.000Z", customerName: "רוני שלו", customerEmail: "roni@example.com", termsVersion: "2026-09-10", termsAcceptedAt: "2026-09-02T11:39:00.000Z", planNameSnapshot: "פרימיום", cardsIncluded: 2, activatedAt: "2026-09-02T12:10:00.000Z" },
];

const demoCustomers: AdminCustomer[] = [
  { id: "u1", name: "איתי ברק", email: "itay@example.com", phone: "0521234567", plan: "pro", status: "trialing", trialEndsAt: "2026-09-12T08:00:00.000Z", periodEnd: "2026-09-12T08:00:00.000Z", joinedAt: "2026-08-29T08:10:00.000Z", approvedAt: null, credentialsSentAt: null, adminLocked: false, adminLockedAt: null, adminLockedReason: "" },
  { id: "u2", name: "מאיה עזר", email: "maya@example.com", phone: "0549876543", plan: "trial", status: "trialing", trialEndsAt: "2026-09-15T14:20:00.000Z", periodEnd: "2026-09-15T14:20:00.000Z", joinedAt: "2026-09-01T14:20:00.000Z", approvedAt: null, credentialsSentAt: null, adminLocked: false, adminLockedAt: null, adminLockedReason: "" },
  { id: "u3", name: "רוני שלו", email: "roni@example.com", phone: "0501112233", plan: "premium", status: "active", trialEndsAt: null, periodEnd: "2026-10-02T11:40:00.000Z", joinedAt: "2026-08-20T11:40:00.000Z", approvedAt: "2026-09-02T12:10:00.000Z", credentialsSentAt: "2026-09-02T12:12:00.000Z", adminLocked: false, adminLockedAt: null, adminLockedReason: "" },
];

type RequestRow = {
  id: string; reference: string; user_id: string; plan_id: string; amount: number | string; method: string;
  status: string; contact_phone: string | null; note: string | null; admin_note: string | null;
  created_at: string; reviewed_at: string | null; billing_cycle?: string | null;
  plan_name_snapshot?: string | null; price_before_discount?: number | string | null; discount_amount?: number | string | null;
  currency?: string | null; cards_included?: number | null; features_snapshot?: string[] | null; pricing_version?: string | null;
  payment_link?: string | null; payment_link_expires_at?: string | null; payment_reference?: string | null;
  invoice_issued?: boolean | null; invoice_reference?: string | null; invoice_issued_at?: string | null;
  invoice_note?: string | null; invoice_sent_to_customer?: boolean | null; customer_notes?: string | null;
  payment_link_sent_at?: string | null; customer_reported_paid_at?: string | null; payment_confirmed_at?: string | null;
  activated_at?: string | null; rejected_at?: string | null; cancelled_at?: string | null; refunded_at?: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    terms_version?: string | null;
    terms_accepted_at?: string | null;
  } | null;
};

const REQUEST_COLUMNS =
  "id,reference,user_id,plan_id,amount,billing_cycle,method,status,contact_phone,note,admin_note,created_at,reviewed_at," +
  "plan_name_snapshot,price_before_discount,discount_amount,currency,cards_included,features_snapshot,pricing_version," +
  "payment_link,payment_link_expires_at,payment_reference,invoice_issued,invoice_reference,invoice_issued_at,invoice_note,invoice_sent_to_customer,customer_notes," +
  "payment_link_sent_at,customer_reported_paid_at,payment_confirmed_at,activated_at,rejected_at,cancelled_at,refunded_at," +
  "profiles(full_name,email,terms_version,terms_accepted_at)";

function mapRequest(row: RequestRow): PaymentRequestRecord {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    planId: row.plan_id as PaymentRequestRecord["planId"],
    amount: Number(row.amount) || 0,
    billingCycle: toBillingCycle(row.billing_cycle),
    method: row.method,
    status: isPurchaseStatus(row.status) ? row.status : "pending_admin_review",
    contactPhone: row.contact_phone || "",
    note: row.note || "",
    adminNote: row.admin_note || "",
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    customerName: row.profiles?.full_name || "ללא שם",
    customerEmail: row.profiles?.email || "",
    termsVersion: row.profiles?.terms_version || "",
    termsAcceptedAt: row.profiles?.terms_accepted_at || null,
    planNameSnapshot: row.plan_name_snapshot || "",
    priceBeforeDiscount: row.price_before_discount === null || row.price_before_discount === undefined ? null : Number(row.price_before_discount),
    discountAmount: Number(row.discount_amount) || 0,
    currency: row.currency || "ILS",
    cardsIncluded: row.cards_included ?? 1,
    featuresSnapshot: row.features_snapshot || [],
    pricingVersion: row.pricing_version || "",
    paymentLink: row.payment_link || null,
    paymentLinkExpiresAt: row.payment_link_expires_at || null,
    paymentReference: row.payment_reference || null,
    invoiceIssued: Boolean(row.invoice_issued),
    invoiceReference: row.invoice_reference || null,
    invoiceIssuedAt: row.invoice_issued_at || null,
    invoiceNote: row.invoice_note || "",
    invoiceSentToCustomer: Boolean(row.invoice_sent_to_customer),
    customerNotes: row.customer_notes || "",
    paymentLinkSentAt: row.payment_link_sent_at || null,
    customerReportedPaidAt: row.customer_reported_paid_at || null,
    paymentConfirmedAt: row.payment_confirmed_at || null,
    activatedAt: row.activated_at || null,
    rejectedAt: row.rejected_at || null,
    cancelledAt: row.cancelled_at || null,
    refundedAt: row.refunded_at || null,
  };
}

export async function getPaymentRequests(viewer: Viewer, filter: PaymentRequestFilter = {}): Promise<PaymentRequestRecord[]> {
  noStore();
  if (viewer.role !== "admin") return [];
  if (viewer.demo || !isSupabaseAdminConfigured) {
    return demoRequests.filter((request) =>
      (!filter.status || request.status === filter.status) &&
      (!filter.planId || request.planId === filter.planId) &&
      (!filter.billingCycle || request.billingCycle === filter.billingCycle) &&
      (!filter.email || request.customerEmail.toLowerCase().includes(filter.email.toLowerCase())) &&
      (!filter.reference || request.reference.toLowerCase().includes(filter.reference.toLowerCase())));
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("payment_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.planId) query = query.eq("plan_id", filter.planId);
  if (filter.billingCycle) query = query.eq("billing_cycle", filter.billingCycle);
  if (filter.reference) query = query.ilike("reference", `%${filter.reference}%`);
  const { data } = await query;
  let rows = ((data || []) as unknown as RequestRow[]).map(mapRequest);
  // סינון לפי אימייל לקוח נעשה אחרי המיפוי — השדה מגיע מטבלה מקושרת.
  if (filter.email) rows = rows.filter((row) => row.customerEmail.toLowerCase().includes(filter.email!.toLowerCase()));
  return rows;
}

export async function getAdminCustomers(viewer: Viewer): Promise<AdminCustomer[]> {
  noStore();
  if (viewer.role !== "admin") return [];
  if (viewer.demo || !isSupabaseAdminConfigured) return demoCustomers;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    admin.from("profiles").select("id,full_name,email,phone,plan_id,created_at,approved_at,credentials_sent_at").order("created_at", { ascending: false }).limit(200),
    admin.from("subscriptions").select("user_id,plan_id,status,current_period_end,trial_ends_at,admin_locked,admin_locked_at,admin_locked_reason"),
  ]);

  const byUser = new Map((subscriptions || []).map((item) => [item.user_id, item]));
  return (profiles || []).map((profile) => {
    const subscription = byUser.get(profile.id);
    return {
      id: profile.id,
      name: profile.full_name || "ללא שם",
      email: profile.email || "",
      phone: profile.phone || "",
      plan: (subscription?.plan_id || profile.plan_id || "trial") as PlanId,
      status: subscription?.status || "trialing",
      trialEndsAt: subscription?.trial_ends_at || null,
      periodEnd: subscription?.current_period_end || null,
      joinedAt: profile.created_at,
      approvedAt: profile.approved_at || null,
      credentialsSentAt: profile.credentials_sent_at || null,
      adminLocked: Boolean(subscription?.admin_locked),
      adminLockedAt: subscription?.admin_locked_at || null,
      adminLockedReason: subscription?.admin_locked_reason || "",
    };
  });
}

/** בקשות התשלום של הלקוח עצמו — כדי להציג "ממתין לאישור" באזור האישי. */
export async function getMyPaymentRequests(viewer: Viewer): Promise<PaymentRequestRecord[]> {
  noStore();
  if (viewer.demo || !isSupabaseAdminConfigured) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data || []) as unknown as RequestRow[]).map(mapRequest);
}
