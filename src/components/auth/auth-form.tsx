"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { AuthResult } from "@/app/(auth)/actions";
import { forgotPasswordAction, loginAction, magicCodeAction, resendOtpAction, signupAction, verifyOtpAction } from "@/app/(auth)/actions";
import { Field, inputClass } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { OtpInput } from "@/components/auth/otp-input";
import { burst } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup" | "forgot";

const tabs: Array<{ id: AuthMode; label: string }> = [
  { id: "login", label: "כניסה" },
  { id: "signup", label: "הרשמה" },
];

const copy: Record<AuthMode, { title: string; description: string }> = {
  login: { title: "טוב לראות אותך שוב", description: "נכנסים וממשיכים לנהל את הכרטיס והפניות." },
  signup: { title: "בואו נבנה את הכרטיס שלך", description: "14 יום עם כל היכולות פתוחות. בלי כרטיס אשראי." },
  forgot: { title: "איפוס סיסמה", description: "נשלח קישור לכתובת שרשומה אצלנו." },
};

/**
 * מסך התחברות מאוחד: כניסה, הרשמה, שכחתי סיסמה ואימות קוד — הכול במקום אחד,
 * בלי ניווט בין עמודים. המצב נשמר ב-URL כדי שרענון או שיתוף קישור ישמרו הקשר.
 */
export function AuthForm({ initialMode = "login", plan = "", next = "" }: { initialMode?: AuthMode; plan?: string; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // הבקשה שכבר "נסגרה" בכפתור חזרה, כדי שהשלב לא יחזור מעצמו.
  const [dismissedOtp, setDismissedOtp] = useState<AuthResult | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const [loginState, login, loginPending] = useActionState(loginAction, null);
  const [signupState, signup, signupPending] = useActionState(signupAction, null);
  const [forgotState, forgot, forgotPending] = useActionState(forgotPasswordAction, null);
  const [magicState, magic, magicPending] = useActionState(magicCodeAction, null);
  const [otpState, verify, otpPending] = useActionState(verifyOtpAction, null);
  const [resendState, resend, resendPending] = useActionState(resendOtpAction, null);

  const state: AuthResult | null = mode === "login" ? loginState : mode === "signup" ? signupState : forgotState;
  const pending = loginPending || signupPending || forgotPending || magicPending || otpPending;

  // שלב הקוד נגזר ישירות מהתוצאה האחרונה שביקשה אימות.
  const otpRequest = [signupState, magicState, loginState].find((candidate) => candidate?.ok && candidate.step === "otp") || null;
  const otpStep = otpRequest && otpRequest !== dismissedOtp ? { email, message: (otpRequest.ok && otpRequest.message) || "" } : null;

  useEffect(() => {
    const done = [loginState, signupState, otpState].find((candidate) => candidate?.ok && candidate.next);
    if (done?.ok && done.next) {
      burst(undefined, { count: 60 });
      router.push(done.next);
    }
  }, [loginState, signupState, otpState, router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setDismissedOtp(otpRequest);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", nextMode);
    window.history.replaceState(null, "", url.toString());
  }

  // ── שלב אימות הקוד ────────────────────────────────────────────────────────
  if (otpStep) {
    const otpError = otpState && !otpState.ok ? otpState.error : "";
    return (
      <div className="grid gap-5">
        <div className="rounded-2xl border border-[#d8d0ff] bg-[#f7f5ff] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-[#4636a6]">
            <ShieldCheck size={17} aria-hidden="true" />אימות כתובת המייל
          </p>
          <p className="mt-1 text-sm leading-6 text-[#6d5fb8]">
            {otpStep.message || "שלחנו קוד בן 6 ספרות"} לכתובת <span dir="ltr" className="font-semibold">{otpStep.email}</span>
          </p>
        </div>

        <form action={verify} className="grid gap-4">
          <input type="hidden" name="email" value={otpStep.email} />
          <input type="hidden" name="next" value={next || (plan ? `/checkout?plan=${plan}` : "/dashboard")} />
          <OtpInput name="code" error={otpError} disabled={otpPending} />

          <button type="submit" disabled={otpPending} className="button-primary min-h-13 w-full">
            {otpPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
            {otpPending ? "מאמתים..." : "אימות והמשך"}
          </button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={resend} className="flex-1">
            <input type="hidden" name="email" value={otpStep.email} />
            <button type="submit" disabled={resendPending} className="button-secondary min-h-12 w-full">
              {resendPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
              שליחת קוד חדש
            </button>
          </form>
          <button type="button" onClick={() => setDismissedOtp(otpRequest)} className="button-ghost min-h-12 flex-1">
            <ArrowRight size={16} aria-hidden="true" />חזרה
          </button>
        </div>

        {resendState?.ok && resendState.message && (
          <p role="status" className="rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{resendState.message}</p>
        )}
        {resendState && !resendState.ok && (
          <p role="alert" className="rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{resendState.error}</p>
        )}
      </div>
    );
  }

  const error = state && !state.ok ? state : null;
  const success = state?.ok && state.message ? state.message : "";

  return (
    <div className="grid gap-6">
      {/* כותרת ומתגי מצב */}
      <div>
        <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">{copy[mode].title}</h1>
        <p className="mt-1.5 text-[#607087]">{copy[mode].description}</p>
      </div>

      {mode !== "forgot" && (
        <div role="tablist" aria-label="מצב התחברות" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f3f7] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => switchMode(tab.id)}
              className={cn(
                "min-h-11 rounded-xl text-sm font-bold transition",
                mode === tab.id ? "bg-white text-[#4b3bad] shadow-sm" : "text-[#68758a] hover:text-[#18243a]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* הודעות ברמת הטופס */}
      {error && !error.field && (
        <p role="alert" className="rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm font-semibold text-[#a32031]">{error.error}</p>
      )}
      {success && (
        <p role="status" className="rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{success}</p>
      )}
      <p ref={liveRef} aria-live="polite" className="sr-only">{pending ? "מעבד את הבקשה" : ""}</p>

      {/* ── כניסה ─────────────────────────────────────────────────────────── */}
      {mode === "login" && (
        <>
          <form action={login} className="grid gap-4">
            <input type="hidden" name="next" value={next || (plan ? `/checkout?plan=${plan}` : "/dashboard")} />
            <Field label="אימייל" required error={error?.field === "email" ? error.error : undefined}>
              {(field) => (
                <input
                  {...field}
                  className={inputClass(error?.field === "email")}
                  name="email"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@business.co.il"
                />
              )}
            </Field>

            <PasswordField
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              showMeter={false}
              error={error?.field === "password" ? error.error : undefined}
            />

            <div className="flex justify-end">
              <button type="button" onClick={() => switchMode("forgot")} className="min-h-11 text-sm font-semibold text-[#6d4aff]">
                שכחתי סיסמה
              </button>
            </div>

            <button type="submit" disabled={pending} className="button-primary min-h-13 w-full">
              {loginPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
              {loginPending ? "נכנסים..." : "כניסה למערכת"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-[#8a95a7]">
            <span className="h-px flex-1 bg-[#e2e6ee]" />או כניסה עם קוד למייל<span className="h-px flex-1 bg-[#e2e6ee]" />
          </div>

          <form action={magic} className="grid gap-3 rounded-2xl bg-[#f6f7fb] p-4">
            <Field label="אימייל לקבלת קוד" required error={magicState && !magicState.ok ? magicState.error : undefined}>
              {(field) => (
                <input
                  {...field}
                  className={inputClass(Boolean(magicState && !magicState.ok))}
                  name="email"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <button type="submit" disabled={pending} className="button-secondary min-h-12 w-full">
              {magicPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
              שליחת קוד חד־פעמי
            </button>
          </form>
        </>
      )}

      {/* ── הרשמה ─────────────────────────────────────────────────────────── */}
      {mode === "signup" && (
        <form action={signup} className="grid gap-4">
          <input type="hidden" name="plan" value={plan} />
          <Field label="שם מלא" required error={error?.field === "fullName" ? error.error : undefined}>
            {(field) => (
              <input
                {...field}
                className={inputClass(error?.field === "fullName")}
                name="fullName"
                autoComplete="name"
                placeholder="ישראל ישראלי"
                minLength={2}
                maxLength={80}
              />
            )}
          </Field>

          <Field label="אימייל עסקי" required error={error?.field === "email" ? error.error : undefined} hint="לכאן יישלח קוד האימות">
            {(field) => (
              <input
                {...field}
                className={inputClass(error?.field === "email")}
                name="email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@business.co.il"
              />
            )}
          </Field>

          <PasswordField
            name="password"
            value={password}
            onChange={setPassword}
            error={error?.field === "password" ? error.error : undefined}
          />

          <label className="flex items-start gap-2 text-xs leading-5 text-[#607087]">
            <input type="checkbox" className="mt-1 h-4 w-4" required aria-required="true" />
            <span>
              קראתי ואני מאשר/ת את <Link href="/legal/terms" className="font-semibold text-[#6d4aff] underline underline-offset-2">תנאי השימוש</Link>
              {" "}ואת <Link href="/legal/privacy" className="font-semibold text-[#6d4aff] underline underline-offset-2">מדיניות הפרטיות</Link>
              <span className="required-field">חובה</span>
            </span>
          </label>

          <button type="submit" disabled={pending} className="button-primary min-h-13 w-full">
            {signupPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
            {signupPending ? "פותחים חשבון..." : plan ? "פתיחת חשבון והמשך לתשלום" : "פתיחת חשבון והתחלה"}
            {!signupPending && <ArrowLeft size={16} aria-hidden="true" />}
          </button>

          <p className="text-center text-xs leading-5 text-[#7c8799]">
            הסיסמה לעולם אינה נשלחת במייל. נשלח קוד אימות בן 6 ספרות בלבד.
          </p>
        </form>
      )}

      {/* ── שכחתי סיסמה ───────────────────────────────────────────────────── */}
      {mode === "forgot" && (
        <form action={forgot} className="grid gap-4">
          <Field label="האימייל שלך" required error={error?.field === "email" ? error.error : undefined} hint="נשלח קישור לאיפוס אם הכתובת רשומה">
            {(field) => (
              <input
                {...field}
                className={inputClass(error?.field === "email")}
                name="email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <button type="submit" disabled={pending} className="button-primary min-h-13 w-full">
            {forgotPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
            שליחת קישור לאיפוס
          </button>

          <button type="button" onClick={() => switchMode("login")} className="button-ghost min-h-12 w-full">
            <ArrowRight size={16} aria-hidden="true" />חזרה לכניסה
          </button>
        </form>
      )}
    </div>
  );
}
