"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clientIp } from "@/lib/rate-limit";
import { bindingDocumentIds, LEGAL_VERSION } from "@/lib/legal";
import { adminNotificationEmail, plans } from "@/lib/config";
import { sendLegalAcceptanceNotification } from "@/lib/email";
import { isSameOriginPath } from "@/lib/safe-url";

export type AcceptResult = { ok: false; error: string } | null;

/**
 * אישור מחדש של המסמכים המשפטיים לאחר עדכון גרסה.
 *
 * האישור נרשם דרך accept_current_terms, שפועלת על auth.uid() בלבד —
 * ולכן משתמש אינו יכול לרשום הסכמה בשם מישהו אחר. הרישום הוא שקובע:
 * כל עוד הוא לא בוצע, שער הכניסה ימשיך לחסום.
 */
export async function acceptTermsAction(_prev: AcceptResult, formData: FormData): Promise<AcceptResult> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  if (!formData.get("terms")) {
    return { ok: false, error: "כדי להמשיך יש לאשר שקראת את הנוסח המעודכן." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "השירות אינו זמין כרגע. אפשר לנסות שוב בעוד רגע." };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי לאשר את המסמכים"));

  const headerList = await headers();
  const ip = await clientIp();
  const userAgent = (headerList.get("user-agent") || "").slice(0, 400);

  const { data: acceptedAt, error } = await supabase.rpc("accept_current_terms", {
    accepted_version: LEGAL_VERSION,
    client_ip: ip,
    client_agent: userAgent,
  });

  if (error) {
    return { ok: false, error: "לא הצלחנו לרשום את האישור. אפשר לנסות שוב, ואם זה חוזר — לפנות אלינו." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,phone,plan_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const planName = plans.find((plan) => plan.id === profile?.plan_id)?.name || "—";

  /*
   * התיעוד למנהל נשלח אחרי שהרישום במסד הצליח, ולעולם לא לפניו: מייל
   * שמעיד על אישור שלא נרשם הוא ראיה שגויה. כשל בשליחה אינו מבטל את
   * האישור עצמו, ולכן הוא נבלע — הראיה הקבועה היא השורה במסד.
   */
  await sendLegalAcceptanceNotification({
    to: adminNotificationEmail,
    customerName: profile?.full_name || auth.user.email || "לקוח",
    customerEmail: auth.user.email || "",
    customerPhone: profile?.phone || "",
    context: "re_accept",
    contextLabel: "אישור מחדש לאחר עדכון נוסח",
    planName,
    documentVersion: LEGAL_VERSION,
    documents: bindingDocumentIds,
    acceptedAt: typeof acceptedAt === "string" ? acceptedAt : new Date().toISOString(),
    ip,
    userAgent,
  }).catch(() => null);

  // יעד פתוח היה הופך את הדף לנקודת הפניה לאתר זר.
  const requested = String(formData.get("next") || "");
  redirect(isSameOriginPath(requested) ? requested : "/dashboard");
}
