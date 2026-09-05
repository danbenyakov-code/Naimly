import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { Viewer } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminContext = { viewer: Viewer; admin: SupabaseClient };

/**
 * שער יחיד לכל נתיבי הניהול. מחזיר Response כשיש לחסום, או ההקשר כשמותר.
 * חשוב: role נקרא מהפרופיל בשרת ולא מהלקוח, ומצב הדגמה לעולם אינו כותב.
 */
export async function requireAdmin(): Promise<AdminContext | Response> {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  if (viewer.role !== "admin") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const limited = rateLimit(`admin:${viewer.id}:${await clientIp()}`, 120, 300);
  if (!limited.ok) return NextResponse.json({ error: "יותר מדי פעולות ניהול ברצף" }, { status: 429 });

  if (viewer.demo) return NextResponse.json({ error: "פעולות ניהול אינן זמינות במצב הדגמה", demo: true }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "שירות הניהול אינו זמין" }, { status: 503 });

  return { viewer, admin };
}

export function isResponse(value: AdminContext | Response): value is Response {
  return value instanceof Response;
}

/** תיעוד כל פעולת ניהול, לצורך מעקב ובקרה. */
export async function auditLog(context: AdminContext, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await context.admin.from("admin_audit_log").insert({
    actor_id: context.viewer.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}
