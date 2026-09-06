"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authSchema } from "@/lib/validation";
import { resolveOrigin } from "@/lib/origin";
import { safeInternalPath } from "@/lib/safe-url";
import { isStrongPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * כל הפעולות מחזירות אובייקט תוצאה במקום לזרוק redirect עם הודעה ב-URL.
 * כך הטופס המאוחד יכול להציג שגיאה ליד השדה הרלוונטי, נגישה לקורא מסך,
 * בלי לאבד את מה שהמשתמש כבר הקליד.
 */
export type AuthResult =
  | { ok: true; message?: string; next?: string; step?: "otp" }
  | { ok: false; error: string; field?: "email" | "password" | "fullName" | "code" };

const genericFailure: AuthResult = { ok: false, error: "לא הצלחנו להשלים את הפעולה. נסו שוב בעוד רגע." };

async function limit(key: string, max: number, windowSeconds: number): Promise<AuthResult | null> {
  const ip = await clientIp();
  const result = rateLimit(`${key}:${ip}`, max, windowSeconds);
  if (result.ok) return null;
  return { ok: false, error: `יותר מדי ניסיונות. אפשר לנסות שוב בעוד ${Math.ceil(result.retryAfterSeconds / 60)} דקות.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// כניסה
// ─────────────────────────────────────────────────────────────────────────────
export async function loginAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: true, next: "/dashboard" };

  const blocked = await limit("login", 10, 600);
  if (blocked) return blocked;

  const parsed = authSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message || "הפרטים אינם תקינים", field: issue?.path?.[0] === "password" ? "password" : "email" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("not confirmed")) {
      return { ok: false, error: "החשבון עדיין לא אומת. שלחנו לך קוד אימות למייל.", field: "email" };
    }
    return { ok: false, error: "האימייל או הסיסמה אינם נכונים", field: "password" };
  }

  const next = safeInternalPath(String(formData.get("next") || ""), "/dashboard");
  return { ok: true, next };
}

// ─────────────────────────────────────────────────────────────────────────────
// הרשמה — מסתיימת באימות קוד שנשלח במייל
// ─────────────────────────────────────────────────────────────────────────────
export async function signupAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const selectedPlan = ["basic", "pro", "premium"].includes(String(formData.get("plan"))) ? String(formData.get("plan")) : "";
  const nextPath = selectedPlan ? `/checkout?plan=${selectedPlan}` : "/dashboard";

  if (!isSupabaseConfigured) return { ok: true, next: nextPath };

  const blocked = await limit("signup", 5, 900);
  if (blocked) return blocked;

  const fullName = String(formData.get("fullName") || "").trim();
  if (fullName.length < 2) return { ok: false, error: "יש להזין שם מלא", field: "fullName" };

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "כתובת האימייל אינה תקינה", field: "email" };
  if (!isStrongPassword(password)) {
    return { ok: false, error: "הסיסמה אינה עומדת בדרישות האבטחה", field: "password" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
  });

  if (error) {
    if (error.message.toLowerCase().includes("registered")) {
      return { ok: false, error: "קיים כבר חשבון עם כתובת זו. אפשר להתחבר או לאפס סיסמה.", field: "email" };
    }
    if (error.message.toLowerCase().includes("password")) {
      return { ok: false, error: "הסיסמה אינה עומדת בדרישות האבטחה", field: "password" };
    }
    return { ok: false, error: "לא הצלחנו ליצור את החשבון", field: "email" };
  }

  // כשאישור מייל פעיל אין session — ממשיכים לשלב הקוד.
  if (!data.session) return { ok: true, step: "otp", message: "שלחנו קוד אימות בן 6 ספרות לכתובת שהזנת." };

  return { ok: true, next: nextPath };
}

// ─────────────────────────────────────────────────────────────────────────────
// אימות קוד חד־פעמי (OTP) שנשלח במייל
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const nextPath = safeInternalPath(String(formData.get("next") || ""), "/dashboard");
  if (!isSupabaseConfigured) return { ok: true, next: nextPath };

  const blocked = await limit("otp", 12, 600);
  if (blocked) return blocked;

  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "יש להזין קוד בן 6 ספרות", field: "code" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  // signup = אימות חשבון חדש, email = קוד כניסה. מנסים את שניהם.
  let { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" }));

  if (error) return { ok: false, error: "הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.", field: "code" };
  return { ok: true, next: nextPath };
}

/** שליחה חוזרת של קוד אימות. */
export async function resendOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: true, message: "במצב הדגמה אין צורך בקוד." };

  const blocked = await limit("otp-resend", 4, 600);
  if (blocked) return blocked;

  const email = String(formData.get("email") || "").trim();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) return { ok: false, error: "לא הצלחנו לשלוח קוד חדש", field: "email" };
  return { ok: true, message: "שלחנו קוד חדש. הוא בתוקף ל‑10 דקות." };
}

// ─────────────────────────────────────────────────────────────────────────────
// כניסה ללא סיסמה — קוד למייל
// ─────────────────────────────────────────────────────────────────────────────
export async function magicCodeAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: true, next: "/dashboard" };

  const blocked = await limit("magic", 6, 600);
  if (blocked) return blocked;

  const email = String(formData.get("email") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "יש להזין כתובת אימייל תקינה", field: "email" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) return { ok: false, error: "לא הצלחנו לשלוח את הקוד", field: "email" };

  return { ok: true, step: "otp", message: "שלחנו קוד בן 6 ספרות למייל שלך." };
}

// ─────────────────────────────────────────────────────────────────────────────
// איפוס סיסמה
// ─────────────────────────────────────────────────────────────────────────────
export async function forgotPasswordAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: true, message: "במצב הדגמה אין צורך באיפוס סיסמה." };

  const blocked = await limit("forgot", 5, 900);
  if (blocked) return blocked;

  const email = String(formData.get("email") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "יש להזין כתובת אימייל תקינה", field: "email" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });

  // תשובה זהה תמיד, כדי לא לחשוף אילו כתובות רשומות במערכת.
  return { ok: true, message: "אם קיים חשבון לכתובת הזו, שלחנו אליה קישור לאיפוס סיסמה." };
}

export async function updatePasswordAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") || "");
  if (!isStrongPassword(password)) return { ok: false, error: "הסיסמה אינה עומדת בדרישות האבטחה", field: "password" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "לא הצלחנו לעדכן את הסיסמה. ייתכן שהקישור פג תוקף.", field: "password" };

  return { ok: true, message: "הסיסמה עודכנה בהצלחה.", next: "/dashboard" };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
