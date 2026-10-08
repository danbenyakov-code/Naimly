"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** סימון/ביטול חשבון בדיקה. מנהל בלבד, נבדק כאן בשרת, ומתועד ביומן הניהול. */
export async function setTestAccountAction(userId: string, isTest: boolean): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.demo) return { ok: false, error: "אין הרשאה" };
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "משתמש לא תקין" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "שירות הניהול אינו זמין" };
  const { error } = await admin.from("profiles").update({ is_test_account: isTest }).eq("id", userId);
  if (error) return { ok: false, error: "לא הצלחנו לעדכן" };

  await admin.from("admin_audit_log").insert({
    actor_id: viewer.id,
    action: isTest ? "user.mark_test" : "user.unmark_test",
    entity_type: "user",
    entity_id: userId,
    details: {},
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
