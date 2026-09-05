"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfileAction(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const fullName = String(formData.get("fullName") || "").trim();
  if (fullName.length < 2 || fullName.length > 80) redirect("/dashboard/settings?error=" + encodeURIComponent("יש להזין שם תקין"));
  if (viewer.demo) redirect("/dashboard/settings?message=" + encodeURIComponent("הפרטים נשמרו במצב הדגמה"));
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/dashboard/settings?error=" + encodeURIComponent("שירות הנתונים אינו זמין"));
  const { error } = await supabase.from("profiles").update({ full_name: fullName, updated_at: new Date().toISOString() }).eq("id", viewer.id);
  if (error) redirect("/dashboard/settings?error=" + encodeURIComponent("לא הצלחנו לשמור את הפרטים"));
  redirect("/dashboard/settings?message=" + encodeURIComponent("הפרטים נשמרו בהצלחה"));
}
