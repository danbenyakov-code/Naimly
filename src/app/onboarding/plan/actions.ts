"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SelectPlanResult = { ok: false; error: string } | null;

/**
 * בחירת ההתנסות — הרגע שבו שעון 14 הימים מתחיל.
 *
 * הבחירה נרשמת בשרת בלבד, ב-`select_trial_plan`, שגם מונעת חידוש חוזר:
 * קריאה שנייה מחזירה את התאריך הקיים במקום לאפס את הספירה.
 */
export async function startTrialAction(): Promise<SelectPlanResult> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "השירות אינו זמין כרגע. אפשר לנסות שוב בעוד רגע." };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?error=" + encodeURIComponent("יש להתחבר כדי לבחור מסלול"));

  const { error } = await supabase.rpc("select_trial_plan");
  if (error) {
    return { ok: false, error: "לא הצלחנו להתחיל את ההתנסות. אפשר לנסות שוב, ואם זה חוזר — לפנות אלינו." };
  }

  redirect("/dashboard?trial=started");
}
