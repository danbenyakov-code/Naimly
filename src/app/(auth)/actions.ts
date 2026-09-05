"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authSchema } from "@/lib/validation";
import { resolveOrigin } from "@/lib/origin";

function authRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

export async function loginAction(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/dashboard?demo=1");
  const parsed = authSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) authRedirect("/login", "error", parsed.error.issues[0]?.message || "הפרטים אינם תקינים");
  const supabase = await createSupabaseServerClient();
  if (!supabase) authRedirect("/login", "error", "שירות ההתחברות אינו זמין כרגע");
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) authRedirect("/login", "error", "האימייל או הסיסמה אינם נכונים");
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const selectedPlan = ["basic", "pro", "premium"].includes(String(formData.get("plan"))) ? String(formData.get("plan")) : "";
  if (!isSupabaseConfigured) redirect(selectedPlan ? `/checkout?plan=${selectedPlan}` : "/dashboard?demo=1");
  const fullName = String(formData.get("fullName") || "").trim();
  const parsed = authSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (fullName.length < 2) authRedirect("/signup", "error", "יש להזין שם מלא");
  if (!parsed.success) authRedirect("/signup", "error", parsed.error.issues[0]?.message || "הפרטים אינם תקינים");
  const supabase = await createSupabaseServerClient();
  if (!supabase) authRedirect("/signup", "error", "שירות ההרשמה אינו זמין כרגע");
  const origin = await resolveOrigin();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(selectedPlan ? `/checkout?plan=${selectedPlan}` : "/dashboard")}` },
  });
  if (error) authRedirect("/signup", "error", error.message.includes("registered") ? "קיים כבר חשבון עם כתובת זו" : "לא הצלחנו ליצור את החשבון");
  if (!data.session) authRedirect("/login", "message", "שלחנו אליך הודעת אימות. לאחר האימות אפשר להתחבר.");
  redirect(selectedPlan ? `/checkout?plan=${selectedPlan}` : "/dashboard");
}

export async function magicLinkAction(formData: FormData) {
  if (!isSupabaseConfigured) redirect("/dashboard?demo=1");
  const email = String(formData.get("email") || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) authRedirect("/login", "error", "יש להזין כתובת אימייל תקינה");
  const supabase = await createSupabaseServerClient();
  if (!supabase) authRedirect("/login", "error", "שירות ההתחברות אינו זמין כרגע");
  const origin = await resolveOrigin();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` } });
  if (error) authRedirect("/login", "error", "לא הצלחנו לשלוח את קישור ההתחברות");
  authRedirect("/login", "message", "קישור התחברות נשלח לאימייל שלך.");
}

export async function forgotPasswordAction(formData: FormData) {
  if (!isSupabaseConfigured) authRedirect("/forgot-password", "message", "במצב הדגמה אין צורך באיפוס סיסמה.");
  const email = String(formData.get("email") || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) authRedirect("/forgot-password", "error", "יש להזין כתובת אימייל תקינה");
  const supabase = await createSupabaseServerClient();
  if (!supabase) authRedirect("/forgot-password", "error", "שירות האיפוס אינו זמין כרגע");
  const origin = await resolveOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) authRedirect("/forgot-password", "error", "לא הצלחנו לשלוח את הודעת האיפוס");
  authRedirect("/forgot-password", "message", "אם קיים חשבון לכתובת הזו, הודעת איפוס נשלחה כעת.");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (password.length < 8) authRedirect("/reset-password", "error", "הסיסמה חייבת להכיל לפחות 8 תווים");
  const supabase = await createSupabaseServerClient();
  if (!supabase) authRedirect("/reset-password", "error", "שירות האיפוס אינו זמין כרגע");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) authRedirect("/reset-password", "error", "לא הצלחנו לעדכן את הסיסמה");
  authRedirect("/login", "message", "הסיסמה עודכנה. אפשר להתחבר כעת.");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
