"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LEGAL_VERSION } from "@/lib/legal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOrigin } from "@/lib/origin";
import { safeInternalPath } from "@/lib/safe-url";
import { evaluatePassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { OTP_RESEND_COOLDOWN_SECONDS, emailSchema, otpSchema } from "@/lib/auth-schema";

/**
 * מודל האימות:
 *   כניסה        — אימייל וסיסמה בלבד.
 *   הרשמה        — אימייל, סיסמה ואימות סיסמה, ואחריהם קוד OTP למייל.
 *   שחזור סיסמה  — קוד OTP למייל, ואחריו בחירת סיסמה חדשה.
 *
 * OTP משמש לאימות זהות בלבד — לא כשיטת כניסה ללא סיסמה.
 *
 * כל פעולה מחזירה אובייקט תוצאה במקום redirect עם הודעה ב-URL, כדי שהטופס
 * יציג שגיאה ליד השדה הרלוונטי בלי לאבד את מה שהמשתמש הקליד.
 */
export type AuthField = "email" | "password" | "passwordConfirm" | "fullName" | "code" | "terms";

export type AuthResult =
  | { ok: true; message?: string; next?: string; step?: "verifyEmail" | "resetOtp" | "choosePassword"; email?: string }
  | { ok: false; error: string; field?: AuthField; retryAfterSeconds?: number };

const genericFailure: AuthResult = {
  ok: false,
  error: "לא הצלחנו להשלים את הפעולה כרגע. הפרטים שהזנת נשמרו בטופס — אפשר לנסות שוב בעוד רגע.",
};

async function limit(key: string, max: number, windowSeconds: number): Promise<AuthResult | null> {
  const ip = await clientIp();
  const result = rateLimit(`${key}:${ip}`, max, windowSeconds);
  if (result.ok) return null;
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
  return {
    ok: false,
    error: `בוצעו יותר מדי ניסיונות מהמכשיר הזה. אפשר לנסות שוב בעוד ${minutes} דקות.`,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// כניסה — אימייל וסיסמה בלבד
// ─────────────────────────────────────────────────────────────────────────────
export async function loginAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const next = safeInternalPath(String(formData.get("next") || ""), "/dashboard");
  if (!isSupabaseConfigured) return { ok: true, next };

  const blocked = await limit("login", 10, 600);
  if (blocked) return blocked;

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) {
    return { ok: false, error: emailCheck.error.issues[0].message, field: "email" };
  }
  if (!password) {
    return { ok: false, error: "יש להזין את הסיסמה שבחרת בהרשמה.", field: "password" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not confirmed")) {
      // החשבון קיים אך לא אומת — מחזירים אותו לשלב הקוד במקום להיתקע.
      await supabase.auth.resend({ type: "signup", email }).catch(() => null);
      return { ok: true, step: "verifyEmail", email, message: "החשבון עדיין לא אומת. שלחנו קוד אימות חדש לכתובת שלך." };
    }
    return {
      ok: false,
      error: "האימייל או הסיסמה אינם נכונים. אם שכחת את הסיסמה, אפשר לאפס אותה מהקישור למטה.",
      field: "password",
    };
  }

  return { ok: true, next };
}

// ─────────────────────────────────────────────────────────────────────────────
// הרשמה — אימייל, סיסמה ואימות סיסמה, ואחריהם קוד למייל
// ─────────────────────────────────────────────────────────────────────────────
export async function signupAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const selectedPlan = ["basic", "pro", "premium"].includes(String(formData.get("plan"))) ? String(formData.get("plan")) : "";
  const nextPath = selectedPlan ? `/checkout?plan=${selectedPlan}` : "/dashboard";

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");
  const terms = formData.get("terms");

  if (fullName.length < 2) {
    return { ok: false, error: "יש להזין שם מלא כדי שנוכל לפנות אליך בשמך.", field: "fullName" };
  }
  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) {
    return { ok: false, error: emailCheck.error.issues[0].message, field: "email" };
  }
  const strength = evaluatePassword(password);
  if (!strength.valid) {
    return { ok: false, error: strength.error, field: "password" };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: "שתי הסיסמאות אינן זהות. יש להזין את אותה סיסמה בשני השדות.", field: "passwordConfirm" };
  }
  if (!terms) {
    return { ok: false, error: "כדי להמשיך יש לאשר את תנאי השימוש ומדיניות הפרטיות.", field: "terms" };
  }

  if (!isSupabaseConfigured) return { ok: true, next: nextPath };

  const blocked = await limit("signup", 5, 900);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("registered") || message.includes("already")) {
      return { ok: false, error: "קיימת כבר הרשמה לכתובת הזו. אפשר להתחבר, או לאפס את הסיסמה אם שכחת אותה.", field: "email" };
    }
    if (message.includes("password")) {
      return { ok: false, error: "הסיסמה נדחתה על ידי שירות האימות. יש לבחור סיסמה אחרת שעומדת בדרישות.", field: "password" };
    }
    return { ok: false, error: "לא הצלחנו ליצור את החשבון. אפשר לנסות שוב או לפנות לתמיכה.", field: "email" };
  }

  /*
   * תיבת הסימון נבדקה למעלה; כאן ההסכמה הופכת לראיה. בלי גרסה, חותמת
   * זמן ו-IP אי אפשר להוכיח למה בדיוק הלקוח הסכים.
   * כישלון בתיעוד לא חוסם הרשמה — אבל הוא נרשם ביומן ולא נבלע.
   */
  if (data.user) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { error: acceptError } = await admin.rpc("record_legal_acceptance", {
        target_user: data.user.id,
        acceptance_context: "signup",
        accepted_version: LEGAL_VERSION,
        client_ip: await clientIp(),
        client_agent: (await headers()).get("user-agent")?.slice(0, 400) || null,
      });
      if (acceptError) console.error("record_legal_acceptance failed", acceptError.message);
    }
  }

  // כשאישור מייל פעיל אין session — ממשיכים לשלב הקוד.
  if (!data.session) {
    return { ok: true, step: "verifyEmail", email, message: "שלחנו קוד אימות בן 6 ספרות לכתובת שהזנת." };
  }

  return { ok: true, next: nextPath };
}

// ─────────────────────────────────────────────────────────────────────────────
// אימות כתובת המייל בהרשמה
// ─────────────────────────────────────────────────────────────────────────────
export async function verifySignupOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const nextPath = safeInternalPath(String(formData.get("next") || ""), "/dashboard");
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").replace(/\D/g, "");

  const codeCheck = otpSchema.safeParse(code);
  if (!codeCheck.success) return { ok: false, error: codeCheck.error.issues[0].message, field: "code" };

  if (!isSupabaseConfigured) return { ok: true, next: nextPath };

  const blocked = await limit("otp-verify", 12, 600);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("expired")) {
      return { ok: false, error: "תוקף הקוד פג. יש לבקש קוד חדש ולהזין אותו תוך 10 דקות.", field: "code" };
    }
    return { ok: false, error: "הקוד שהוזן אינו נכון. יש לבדוק את ההודעה במייל ולהזין שוב.", field: "code" };
  }

  return { ok: true, next: nextPath, message: "הכתובת אומתה בהצלחה." };
}

/** שליחה חוזרת של קוד אימות ההרשמה. */
export async function resendSignupOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  if (!isSupabaseConfigured) return { ok: true, message: "במצב הדגמה אין צורך בקוד אימות." };

  const blocked = await limit("otp-resend", 4, OTP_RESEND_COOLDOWN_SECONDS * 4);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) {
    return { ok: false, error: "לא הצלחנו לשלוח קוד חדש כרגע. אפשר לנסות שוב בעוד דקה.", field: "email" };
  }
  return { ok: true, message: "שלחנו קוד חדש. הוא בתוקף ל‑10 דקות." };
}

// ─────────────────────────────────────────────────────────────────────────────
// שחזור סיסמה — קוד למייל, ואחריו סיסמה חדשה
// ─────────────────────────────────────────────────────────────────────────────
export async function requestPasswordResetAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();

  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) return { ok: false, error: emailCheck.error.issues[0].message, field: "email" };

  if (!isSupabaseConfigured) {
    return { ok: true, step: "resetOtp", email, message: "במצב הדגמה אין צורך בקוד — אפשר להמשיך." };
  }

  const blocked = await limit("reset-request", 5, 900);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });

  // תשובה זהה תמיד — לא חושפים אילו כתובות רשומות במערכת.
  return {
    ok: true,
    step: "resetOtp",
    email,
    message: "אם קיים חשבון לכתובת הזו, שלחנו אליה קוד אימות בן 6 ספרות.",
  };
}

/**
 * אימות קוד השחזור. בהצלחה נפתח session מוגבל שמאפשר לקבוע סיסמה חדשה.
 */
export async function verifyResetOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").replace(/\D/g, "");

  const codeCheck = otpSchema.safeParse(code);
  if (!codeCheck.success) return { ok: false, error: codeCheck.error.issues[0].message, field: "code" };

  if (!isSupabaseConfigured) return { ok: true, step: "choosePassword", email };

  const blocked = await limit("reset-verify", 12, 600);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("expired")) {
      return { ok: false, error: "תוקף הקוד פג. יש לבקש קוד חדש ולהזין אותו תוך 10 דקות.", field: "code" };
    }
    return { ok: false, error: "הקוד שהוזן אינו נכון. יש לבדוק את ההודעה במייל ולהזין שוב.", field: "code" };
  }

  return { ok: true, step: "choosePassword", email, message: "הזהות אומתה. אפשר לבחור סיסמה חדשה." };
}

/** שליחה חוזרת של קוד שחזור. */
export async function resendResetOtpAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  if (!isSupabaseConfigured) return { ok: true, message: "במצב הדגמה אין צורך בקוד." };

  const blocked = await limit("reset-resend", 4, OTP_RESEND_COOLDOWN_SECONDS * 4);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const origin = await resolveOrigin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  return { ok: true, message: "שלחנו קוד חדש. הוא בתוקף ל‑10 דקות." };
}

// ─────────────────────────────────────────────────────────────────────────────
// קביעת סיסמה חדשה
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePasswordAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");

  const strength = evaluatePassword(password);
  if (!strength.valid) return { ok: false, error: strength.error, field: "password" };
  if (password !== passwordConfirm) {
    return { ok: false, error: "שתי הסיסמאות אינן זהות. יש להזין את אותה סיסמה בשני השדות.", field: "passwordConfirm" };
  }

  if (!isSupabaseConfigured) return { ok: true, message: "הסיסמה עודכנה (מצב הדגמה).", next: "/dashboard" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return genericFailure;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("session") || message.includes("jwt")) {
      return {
        ok: false,
        error: "פג תוקף האימות. יש להתחיל את תהליך שחזור הסיסמה מחדש.",
        field: "password",
      };
    }
    if (message.includes("same")) {
      return { ok: false, error: "הסיסמה החדשה זהה לסיסמה הקיימת. יש לבחור סיסמה אחרת.", field: "password" };
    }
    return { ok: false, error: "לא הצלחנו לעדכן את הסיסמה. אפשר לנסות שוב או לפנות לתמיכה.", field: "password" };
  }

  return { ok: true, message: "הסיסמה עודכנה בהצלחה.", next: "/dashboard" };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
