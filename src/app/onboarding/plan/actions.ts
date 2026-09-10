"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clientIp } from "@/lib/rate-limit";
import { LEGAL_VERSION } from "@/lib/legal";

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
  const { error } = await supabase.rpc("select_trial_plan", {
    accepted_version: LEGAL_VERSION,
    client_ip: await clientIp(),
    client_agent: (headerList.get("user-agent") || "").slice(0, 400),
  });

  if (error) {
    if (error.message.includes("TERMS_REQUIRED")) {
      return { ok: false, field: "terms", error: "יש לאשר את המסמכים המשפטיים כדי להמשיך." };
    }
    return { ok: false, error: "לא הצלחנו להתחיל את ההתנסות. אפשר לנסות שוב, ואם זה חוזר — לפנות אלינו." };
  }

  redirect("/dashboard?trial=started");
}
