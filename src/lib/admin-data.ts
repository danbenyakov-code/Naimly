import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { PlanId, Viewer } from "@/lib/types";

export type PaymentRequestRecord = {
  id: string;
  reference: string;
  userId: string;
  planId: Exclude<PlanId, "trial">;
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected" | "canceled";
  contactPhone: string;
  note: string;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  customerName: string;
  customerEmail: string;
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
};

const demoRequests: PaymentRequestRecord[] = [
  { id: "pr1", reference: "PR-8F21C4-K3A9", userId: "u1", planId: "pro", amount: 49, method: "bit", status: "pending", contactPhone: "0521234567", note: "שילמתי בביט, מצרף צילום מסך בוואטסאפ", adminNote: "", createdAt: "2026-09-05T08:20:00.000Z", reviewedAt: null, customerName: "איתי ברק", customerEmail: "itay@example.com" },
  { id: "pr2", reference: "BA-2D77A1-M8X2", userId: "u2", planId: "basic", amount: 29, method: "bit", status: "pending", contactPhone: "0549876543", note: "", adminNote: "", createdAt: "2026-09-04T16:05:00.000Z", reviewedAt: null, customerName: "מאיה עזר", customerEmail: "maya@example.com" },
  { id: "pr3", reference: "PM-91BB03-Q1Z7", userId: "u3", planId: "premium", amount: 79, method: "bit", status: "approved", contactPhone: "0501112233", note: "", adminNote: "אושר לאחר אימות בביט", createdAt: "2026-09-02T11:40:00.000Z", reviewedAt: "2026-09-02T12:10:00.000Z", customerName: "רוני שלו", customerEmail: "roni@example.com" },
];

const demoCustomers: AdminCustomer[] = [
  { id: "u1", name: "איתי ברק", email: "itay@example.com", phone: "0521234567", plan: "pro", status: "trialing", trialEndsAt: "2026-09-12T08:00:00.000Z", periodEnd: "2026-09-12T08:00:00.000Z", joinedAt: "2026-08-29T08:10:00.000Z", approvedAt: null, credentialsSentAt: null },
  { id: "u2", name: "מאיה עזר", email: "maya@example.com", phone: "0549876543", plan: "trial", status: "trialing", trialEndsAt: "2026-09-15T14:20:00.000Z", periodEnd: "2026-09-15T14:20:00.000Z", joinedAt: "2026-09-01T14:20:00.000Z", approvedAt: null, credentialsSentAt: null },
  { id: "u3", name: "רוני שלו", email: "roni@example.com", phone: "0501112233", plan: "premium", status: "active", trialEndsAt: null, periodEnd: "2026-10-02T11:40:00.000Z", joinedAt: "2026-08-20T11:40:00.000Z", approvedAt: "2026-09-02T12:10:00.000Z", credentialsSentAt: "2026-09-02T12:12:00.000Z" },
];

type RequestRow = {
  id: string; reference: string; user_id: string; plan_id: string; amount: number | string; method: string;
  status: string; contact_phone: string | null; note: string | null; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function mapRequest(row: RequestRow): PaymentRequestRecord {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    planId: row.plan_id as PaymentRequestRecord["planId"],
    amount: Number(row.amount) || 0,
    method: row.method,
    status: row.status as PaymentRequestRecord["status"],
    contactPhone: row.contact_phone || "",
    note: row.note || "",
    adminNote: row.admin_note || "",
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    customerName: row.profiles?.full_name || "ללא שם",
    customerEmail: row.profiles?.email || "",
  };
}

export async function getPaymentRequests(viewer: Viewer, status?: PaymentRequestRecord["status"]): Promise<PaymentRequestRecord[]> {
  noStore();
  if (viewer.role !== "admin") return [];
  if (viewer.demo || !isSupabaseAdminConfigured) {
    return status ? demoRequests.filter((request) => request.status === status) : demoRequests;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin
    .from("payment_requests")
    .select("id,reference,user_id,plan_id,amount,method,status,contact_phone,note,admin_note,created_at,reviewed_at,profiles(full_name,email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return ((data || []) as unknown as RequestRow[]).map(mapRequest);
}

export async function getAdminCustomers(viewer: Viewer): Promise<AdminCustomer[]> {
  noStore();
  if (viewer.role !== "admin") return [];
  if (viewer.demo || !isSupabaseAdminConfigured) return demoCustomers;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    admin.from("profiles").select("id,full_name,email,phone,plan_id,created_at,approved_at,credentials_sent_at").order("created_at", { ascending: false }).limit(200),
    admin.from("subscriptions").select("user_id,plan_id,status,current_period_end,trial_ends_at"),
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
    .select("id,reference,user_id,plan_id,amount,method,status,contact_phone,note,admin_note,created_at,reviewed_at,profiles(full_name,email)")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data || []) as unknown as RequestRow[]).map(mapRequest);
}
