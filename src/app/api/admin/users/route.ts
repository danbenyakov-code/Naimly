import { NextResponse } from "next/server";
import { z } from "zod";
import { plans } from "@/lib/config";
import { auditLog, isResponse, requireAdmin } from "@/lib/admin-guard";
import { canonicalOrigin } from "@/lib/origin";
import { credentialsMessage, whatsappTo } from "@/lib/payments";
import { planName } from "@/lib/plan-access";

const createSchema = z.object({
  email: z.string().email("כתובת האימייל אינה תקינה"),
  fullName: z.string().min(2, "יש להזין שם מלא").max(80),
  phone: z.string().max(30).optional(),
  planId: z.enum(["trial", "basic", "pro", "premium"]),
  months: z.number().int().min(1).max(24).optional(),
});

/** סיסמה זמנית קריאה אך אקראית — נוצרת בשרת ומוצגת למנהל פעם אחת בלבד. */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * יצירת חשבון ללקוח על ידי מנהל, כולל סיסמה זמנית.
 * הסיסמה מוחזרת פעם אחת בלבד בתשובה, כדי שהמנהל ישלח אותה בוואטסאפ.
 */
export async function POST(request: Request) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;
  const { admin } = context;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });

  const { email, fullName, phone, planId } = parsed.data;
  const months = parsed.data.months || 1;
  const password = generatePassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    const duplicate = createError?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      { error: duplicate ? "קיים כבר חשבון עם כתובת האימייל הזו" : "לא הצלחנו ליצור את החשבון" },
      { status: duplicate ? 409 : 500 },
    );
  }

  const userId = created.user.id;

  // הטריגר handle_new_user יוצר פרופיל ומנוי התנסות; כאן משלימים את הפרטים.
  await admin.from("profiles").update({
    full_name: fullName,
    email,
    phone: phone || "",
    created_by_admin: true,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  if (planId !== "trial") {
    const { error: activateError } = await admin.rpc("activate_subscription", {
      target_user: userId,
      target_plan: planId,
      months,
      actor: context.viewer.id,
    });
    if (activateError) {
      return NextResponse.json({ error: "החשבון נוצר אך הפעלת המסלול נכשלה" }, { status: 500 });
    }
  }

  await auditLog(context, "user.create", "user", userId, { email, plan: planId, months });

  const loginUrl = `${canonicalOrigin() || ""}/login`;
  const message = credentialsMessage({ email, password, loginUrl, planName: planName(planId) });

  return NextResponse.json({
    ok: true,
    userId,
    email,
    // מוצג פעם אחת בלבד. לא נשמר בשום מקום.
    password,
    whatsappUrl: phone ? whatsappTo(phone, message) : "",
    message,
  });
}

const credentialsSchema = z.object({
  userId: z.string().uuid(),
  // רק איפוס סיסמה. קישור כניסה ללא סיסמה הוסר במכוון מכל המערכת.
  mode: z.literal("reset_password"),
  phone: z.string().max(30).optional(),
});

/**
 * שליחת פרטי כניסה מחדש ללקוח קיים: איפוס סיסמה או קישור כניסה חד־פעמי.
 * הקישור נוצר דרך Supabase Admin ומוחזר למנהל לשליחה בוואטסאפ.
 */
export async function PATCH(request: Request) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;
  const { admin } = context;

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const { data: profile } = await admin
    .from("profiles")
    .select("id,email,full_name,phone,plan_id")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!profile?.email) return NextResponse.json({ error: "הלקוח לא נמצא" }, { status: 404 });

  const origin = canonicalOrigin() || "";
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: profile.email,
    options: { redirectTo: `${origin}/auth/callback?next=%2Freset-password` },
  });
  if (error || !link?.properties?.action_link) {
    return NextResponse.json({ error: "לא הצלחנו ליצור קישור כניסה" }, { status: 500 });
  }

  await admin.from("profiles").update({ credentials_sent_at: new Date().toISOString() }).eq("id", profile.id);
  await auditLog(context, "user.credentials", "user", profile.id, { mode: parsed.data.mode });

  const message = credentialsMessage({
    email: profile.email,
    loginUrl: `${origin}/login`,
    planName: planName((profile.plan_id || "trial") as Parameters<typeof planName>[0]),
    resetLink: link.properties.action_link,
  });
  const phone = parsed.data.phone || profile.phone || "";

  return NextResponse.json({
    ok: true,
    actionLink: link.properties.action_link,
    message,
    whatsappUrl: phone ? whatsappTo(phone, message) : "",
  });
}

const planSchema = z.object({
  userId: z.string().uuid(),
  planId: z.enum(["basic", "pro", "premium"]),
  months: z.number().int().min(1).max(24).optional(),
});

/** הפעלה או הארכה ידנית של מסלול, ללא בקשת תשלום מקדימה. */
export async function PUT(request: Request) {
  const context = await requireAdmin();
  if (isResponse(context)) return context;

  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const plan = plans.find((item) => item.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 404 });

  const months = parsed.data.months || 1;
  const { error } = await context.admin.rpc("activate_subscription", {
    target_user: parsed.data.userId,
    target_plan: plan.id,
    months,
    actor: context.viewer.id,
  });
  if (error) return NextResponse.json({ error: "הפעלת המסלול נכשלה" }, { status: 500 });

  await auditLog(context, "subscription.manual_activate", "user", parsed.data.userId, { plan: plan.id, months });
  return NextResponse.json({ ok: true, plan: plan.id, months });
}
