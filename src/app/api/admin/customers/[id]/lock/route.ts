import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, isResponse, requireAdmin } from "@/lib/admin-guard";

const schema = z.object({
  locked: z.boolean(),
  reason: z.string().max(300).optional(),
});

/**
 * נעילה/שחרור ידניים של מנוי — למקרה של אי-תשלום שהתגלה מחוץ למחזור,
 * חיוב שהתהפך (chargeback) או הפרת תנאים. נפרד לגמרי מתפוגת מנוי
 * טבעית (שנאכפת אוטומטית ב-effective_plan לפי current_period_end).
 *
 * admin_set_subscription_lock חוסמת גישה מיידית: effective_plan
 * מחזירה 'none' לכל מנוי נעול, בלי קשר לסטטוס או לתוקף שלו.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;
  const { admin, viewer } = context;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "מזהה משתמש אינו תקין" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  if (parsed.data.locked && !parsed.data.reason?.trim()) {
    return NextResponse.json({ error: "יש לציין סיבת נעילה" }, { status: 400 });
  }

  const { error } = await admin.rpc("admin_set_subscription_lock", {
    target_user: id,
    actor: viewer.id,
    locked: parsed.data.locked,
    reason: parsed.data.reason || "",
  });
  if (error) return NextResponse.json({ error: "הפעולה נכשלה" }, { status: 500 });

  await auditLog(context, parsed.data.locked ? "subscription.lock" : "subscription.unlock", "user", id, { reason: parsed.data.reason });

  return NextResponse.json({ ok: true, locked: parsed.data.locked });
}
