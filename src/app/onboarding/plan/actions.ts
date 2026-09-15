"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clientIp } from "@/lib/rate-limit";
import { bindingDocumentIds, LEGAL_VERSION } from "@/lib/legal";
import { adminNotificationEmail, plans } from "@/lib/config";
import { sendLegalAcceptanceNotification } from "@/lib/email";

export type SelectPlanResult = { ok: false; error: string; field?: "terms" } | null;

/**
 * בחירת ההתנסות — הרגע שבו שעון 14 הימים מתחיל.
 *
 * האישור נאכף בשרת ובמסד, ולא רק בתיבת הסימון: `select_trial_plan`
 * דוחה קריאה בלי גרסת מסמכים. תיבה בממשק בלבד אינה ראיה לכלום, כי
 * אפשר לשלוח את הבקשה בלעדיה.
 *
 * ההסכמה נשמרת עם גרסה, חותמת זמן, IP וזיהוי דפדפן — אחרת אין דרך
 * להוכיח למה בדיוק הלקוח הסכים ומתי.
 */
export async function startTrialAction(_prev: SelectPlanResult, formData: FormData): Promise<SelectPlanResult> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  if (!formData.get("terms")) {
    return {
      ok: false,
      field: "terms",
      error: "כדי להתחיל יש לאשר שקראת את תנאי השימוש, מדיניות הפרטיות ומדיניות הביטולים.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "השירות אינו זמין כרגע. אפשר לנסות שוב בעוד רגע." };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי לבחור מסלול"));

  const headerList = await headers();
  const ip = await clientIp();
  const userAgent = (headerList.get("user-agent") || "").slice(0, 400);

  const { error } = await supabase.rpc("select_trial_plan", {
    accepted_version: LEGAL_VERSION,
    client_ip: ip,
    client_agent: userAgent,
  });

  if (error) {
    if (error.message.includes("TERMS_REQUIRED")) {
      return { ok: false, field: "terms", error: "יש לאשר את המסמכים המשפטיים כדי להמשיך." };
    }
    /*
     * REQ-014: ההתנסות מוגבלת לכתובת דוא״ל אחת. ההודעה אומרת מה קרה
     * ומה אפשר לעשות עכשיו — "אירעה שגיאה" היה משאיר את הלקוח תקוע
     * בלי להבין שהמסלול בתשלום פתוח בפניו.
     */
    if (error.message.includes("TRIAL_ALREADY_USED")) {
      return {
        ok: false,
        error: "כתובת האימייל הזו כבר מימשה תקופת התנסות. אפשר להמשיך במסלול בתשלום — הכרטיס שבנית נשמר.",
      };
    }
    return { ok: false, error: "לא הצלחנו להתחיל את ההתנסות. אפשר לנסות שוב, ואם זה חוזר — לפנות אלינו." };
  }

  /*
   * התיעוד למנהל נשלח רק אחרי שהרישום במסד הצליח. מייל שמעיד על
   * אישור שלא נרשם הוא ראיה שגויה, וגרועה מהיעדר ראיה.
   *
   * חייב להישלח לפני ה-redirect: redirect זורק, וכל מה שאחריו לא ירוץ.
   */
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,phone")
    .eq("id", auth.user.id)
    .maybeSingle();

  await sendLegalAcceptanceNotification({
    to: adminNotificationEmail,
    customerName: profile?.full_name || auth.user.email || "לקוח",
    customerEmail: auth.user.email || "",
    customerPhone: profile?.phone || "",
    context: "plan",
    contextLabel: "בחירת מסלול התנסות",
    planName: plans.find((plan) => plan.id === "trial")?.name || "התנסות",
    documentVersion: LEGAL_VERSION,
    documents: bindingDocumentIds,
    acceptedAt: new Date().toISOString(),
    ip,
    userAgent,
  }).catch(() => null);

  redirect("/dashboard?trial=started");
}
