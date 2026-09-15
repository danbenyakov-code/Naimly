import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendLegalAcceptanceNotification } from "@/lib/email";
import { planName } from "@/lib/plan-access";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { PlanId } from "@/lib/types";

/**
 * אישור עצמי ללקוח (REQ-012).
 *
 * תנאי הקבלה דורשים שניתן יהיה "להפיק תיעוד או לשלוח אישור עצמי".
 * תיעוד שקיים במסד אך רק המנהל יכול לראות אינו עונה על הדרישה: ללקוח
 * אין דרך להוכיח למה הסכים.
 *
 * הרשומה נקראת דרך ה-client של המשתמש, ולכן RLS מבטיחה שהוא מקבל את
 * ההסכמות שלו בלבד — גם אם יישלח מזהה של מישהו אחר.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });

  if (viewer.demo) {
    return NextResponse.json({ error: "במצב הדגמה אין רשומת אישור אמיתית לשלוח." }, { status: 400 });
  }

  const limited = rateLimit(`acceptance-copy:${viewer.id}`, 3, 900);
  if (!limited.ok) return tooManyRequests(limited, "נשלחו יותר מדי עותקים ברצף. אפשר לנסות שוב בעוד מספר דקות.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "שירות הנתונים אינו זמין" }, { status: 503 });

  const { data: record } = await supabase
    .from("legal_acceptances")
    .select("reference,context,document_version,documents,plan_id,ip_address,user_agent,accepted_at")
    .eq("user_id", viewer.id)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: "לא נמצאה רשומת אישור בחשבון הזה." }, { status: 404 });
  }

  const contextLabels: Record<string, string> = {
    signup: "פתיחת חשבון",
    plan: "בחירת מסלול",
    re_accept: "אישור מחדש לאחר עדכון נוסח",
  };

  const result = await sendLegalAcceptanceNotification({
    to: viewer.email,
    audience: "customer",
    customerName: viewer.fullName,
    customerEmail: viewer.email,
    context: (record.context as "signup" | "plan" | "re_accept") || "plan",
    contextLabel: contextLabels[String(record.context)] || "אישור תנאים",
    planName: record.plan_id ? planName(record.plan_id as PlanId) : "—",
    documentVersion: String(record.document_version || ""),
    documents: Array.isArray(record.documents) ? record.documents.map(String) : [],
    acceptedAt: String(record.accepted_at || ""),
    reference: record.reference ? String(record.reference) : undefined,
    ip: record.ip_address ? String(record.ip_address) : undefined,
    userAgent: record.user_agent ? String(record.user_agent) : undefined,
  });

  // אין מדווחים על שליחה שלא קרתה.
  if (!result.sent) {
    return NextResponse.json({
      error: `לא הצלחנו לשלוח את האישור לכתובת ${viewer.email}.`,
    }, { status: 502 });
  }

  return NextResponse.json({ ok: true, target: viewer.email, reference: record.reference });
}
