import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserOverviewRow } from "@/lib/user-control";
import type { Viewer } from "@/lib/types";

export type UserEventRecord = {
  id: number;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * קריאות מסך הבקרה. כולן עם מפתח השירות, ולכן כל אחת בודקת בעצמה שהצופה
 * מנהל: הגנת ה-layout היא שכבה אחת, לא היחידה.
 */
function adminClientFor(viewer: Viewer | null) {
  if (!viewer || viewer.role !== "admin" || viewer.demo) return null;
  return createSupabaseAdminClient();
}

export async function getUsersOverview(viewer: Viewer | null): Promise<UserOverviewRow[]> {
  noStore();
  const admin = adminClientFor(viewer);
  if (!admin) return [];
  // תפוגות אינן "כתיבה" ולכן נרשמות בסנכרון. השעה שנשמרת היא שעת התפוגה האמיתית.
  await admin.rpc("sync_lifecycle_events");
  const { data, error } = await admin.rpc("admin_users_overview");
  if (error) {
    console.error(`[user-control] overview ${error.code} ${error.message}`);
    return [];
  }
  return (data || []) as UserOverviewRow[];
}

export async function getUserControlDetail(viewer: Viewer | null, userId: string): Promise<{ row: UserOverviewRow; events: UserEventRecord[] } | null> {
  noStore();
  const admin = adminClientFor(viewer);
  if (!admin) return null;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  await admin.rpc("sync_lifecycle_events");
  const [{ data: rows }, { data: events }] = await Promise.all([
    admin.rpc("admin_users_overview", { target_user: userId }),
    admin.from("user_events").select("id,event_type,metadata,created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1000),
  ]);
  const row = ((rows || []) as UserOverviewRow[])[0];
  if (!row) return null;
  return { row, events: (events || []) as UserEventRecord[] };
}

/**
 * "נכנס למערכת": נרשם פעם ביום לכל היותר (הבדיקה במסד). כשל כאן לעולם
 * אינו חוסם את הדשבורד.
 */
export async function recordAppVisit(viewer: Viewer) {
  if (viewer.demo) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin.rpc("record_app_visit", { target_user: viewer.id });
  } catch {
    // מדידה בלבד.
  }
}
