"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { AuthResult } from "@/app/(auth)/actions";
import {
  loginAction,
  requestPasswordResetAction,
  resendResetOtpAction,
  resendSignupOtpAction,
  signupAction,
  updatePasswordAction,
  verifyResetOtpAction,
  verifySignupOtpAction,
} from "@/app/(auth)/actions";
import { Field, FormAlert, inputClass } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { OtpInput } from "@/components/auth/otp-input";
import { ResendButton } from "@/components/auth/resend-button";
import { burst } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup" | "forgot";

/** השלב בתוך הזרימה. OTP מופיע רק לאימות הרשמה ולשחזור סיסמה. */
type Step = "form" | "verifyEmail" | "resetOtp" | "choosePassword";

const tabs: Array<{ id: AuthMode; label: string }> = [
  { id: "login", label: "כניסה" },
  { id: "signup", label: "הרשמה" },
];

const headings: Record<AuthMode, { title: string; description: string }> = {
  login: { title: "טוב לראות אותך שוב", description: "כניסה עם אימייל וסיסמה." },
  signup: { title: "בואו נבנה את הכרטיס שלך", description: "14 יום עם כל היכולות פתוחות. בלי כרטיס אשראי." },
  forgot: { title: "שחזור סיסמה", description: "נשלח קוד אימות למייל, ואחריו תבחרו סיסמה חדשה." },
};

/**
 * מסך אימות מאוחד. הכניסה היא באימייל וסיסמה בלבד — אין כניסה ללא סיסמה.
 * קוד ה‑OTP משמש רק לאימות כתובת בהרשמה ולזיהוי בשחזור סיסמה.
 */
export function AuthForm({ initialMode = "login", plan = "", next = "" }: { initialMode?: AuthMode; plan?: string; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  // התוצאה שהמשתמש "סגר" בכפתור חזרה, כדי שהשלב לא יחזור מעצמו.
  const [dismissed, setDismissed] = useState<AuthResult | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [loginState, login, loginPending] = useActionState(loginAction, null);
  const [signupState, signup, signupPending] = useActionState(signupAction, null);
  const [verifyState, verify, verifyPending] = useActionState(verifySignupOtpAction, null);
  const [resendSignup, resendSignupAction, resendSignupPending] = useActionState(resendSignupOtpAction, null);
  const [resetReqState, requestReset, resetReqPending] = useActionState(requestPasswordResetAction, null);
  const [resetOtpState, verifyReset, resetOtpPending] = useActionState(verifyResetOtpAction, null);
  const [resendReset, resendResetAction, resendResetPending] = useActionState(resendResetOtpAction, null);
  const [updateState, updatePassword, updatePending] = useActionState(updatePasswordAction, null);

  const successTarget = next || (plan ? `/checkout?plan=${plan}` : "/dashboard");

  /*
   * השלב נגזר מהתוצאה האחרונה שהחזירה step. הסדר חשוב: choosePassword
   * מגיע מ-resetOtpState ולכן נבדק לפני resetReqState.
   */
  const stepResult = [resetOtpState, signupState, loginState, resetReqState].find((result) => result?.ok && result.step) || null;
  const step: Step = stepResult && stepResult !== dismissed && stepResult.ok && stepResult.step ? stepResult.step : "form";
  const stepEmail = stepResult?.ok && stepResult.email ? stepResult.email : email;

  // ניווט אחרי הצלחה סופית.
  useEffect(() => {
    const done = [loginState, signupState, verifyState, updateState].find((result) => result?.ok && result.next);
    if (done?.ok && done.next) {
      burst(undefined, { count: 60 });
      router.push(done.next);
    }
  }, [loginState, signupState, verifyState, updateState, router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setDismissed(stepResult);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", nextMode);
    window.history.replaceState(null, "", url.toString());
  }

  const fieldError = (result: AuthResult | null, field: string) =>
    result && !result.ok && result.field === field ? result.error : undefined;
  const formError = (result: AuthResult | null) =>
    result && !result.ok && !result.field ? result.error : undefined;

  // ── שלב: אימות כתובת המייל בהרשמה ────────────────────────────────────────
  if (step === "verifyEmail") {
    return (
      <div className="grid gap-5">
        <StepHeader
          icon={<ShieldCheck size={17} aria-hidden="true" />}
          title="אימות כתובת המייל"
          body={<>שלחנו קוד בן 6 ספרות לכתובת <Email value={stepEmail} />. הקוד בתוקף ל‑10 דקות.</>}
        />

        {formError(verifyState) && <FormAlert tone="error">{formError(verifyState)}</FormAlert>}
        {resendSignup?.ok && resendSignup.message && <FormAlert tone="success">{resendSignup.message}</FormAlert>}
        {resendSignup && !resendSignup.ok && <FormAlert tone="error">{resendSignup.error}</FormAlert>}

        <form action={verify} className="grid gap-4">
          <input type="hidden" name="email" value={stepEmail} />
          <input type="hidden" name="next" value={successTarget} />
          <OtpInput name="code" error={fieldError(verifyState, "code")} disabled={verifyPending} />
          <button type="submit" disabled={verifyPending} className="button-primary min-h-13 w-full" aria-busy={verifyPending}>
            {verifyPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
            {verifyPending ? "מאמתים את הקוד..." : "אימות והמשך"}
          </button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row">
          <ResendButton action={resendSignupAction} email={stepEmail} pending={resendSignupPending} />
          <button type="button" onClick={() => switchMode("signup")} className="button-ghost min-h-12 flex-1">
            <ArrowRight size={16} aria-hidden="true" />שינוי כתובת המייל
          </button>
        </div>
      </div>
    );
  }

  // ── שלב: אימות קוד שחזור ─────────────────────────────────────────────────
  if (step === "resetOtp") {
    return (
      <div className="grid gap-5">
        <StepHeader
          icon={<LockKeyhole size={17} aria-hidden="true" />}
          title="אימות זהות"
          body={<>{resetReqState?.ok && resetReqState.message ? resetReqState.message : <>שלחנו קוד לכתובת <Email value={stepEmail} />.</>}</>}
        />

        {formError(resetOtpState) && <FormAlert tone="error">{formError(resetOtpState)}</FormAlert>}
        {resendReset?.ok && resendReset.message && <FormAlert tone="success">{resendReset.message}</FormAlert>}

        <form action={verifyReset} className="grid gap-4">
          <input type="hidden" name="email" value={stepEmail} />
          <OtpInput name="code" error={fieldError(resetOtpState, "code")} disabled={resetOtpPending} />
          <button type="submit" disabled={resetOtpPending} className="button-primary min-h-13 w-full" aria-busy={resetOtpPending}>
            {resetOtpPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
            {resetOtpPending ? "מאמתים את הקוד..." : "אימות והמשך"}
          </button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row">
          <ResendButton action={resendResetAction} email={stepEmail} pending={resendResetPending} />
          <button type="button" onClick={() => switchMode("login")} className="button-ghost min-h-12 flex-1">
            <ArrowRight size={16} aria-hidden="true" />חזרה לכניסה
          </button>
        </div>
      </div>
    );
  }

  // ── שלב: בחירת סיסמה חדשה ────────────────────────────────────────────────
  if (step === "choosePassword") {
    const mismatch = newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm;
    return (
      <div className="grid gap-5">
        <StepHeader
          icon={<KeyRound size={17} aria-hidden="true" />}
          title="בחירת סיסמה חדשה"
          body="הזהות אומתה. הסיסמה החדשה תיכנס לתוקף מיד."
        />

        {formError(updateState) && <FormAlert tone="error">{formError(updateState)}</FormAlert>}

        <form action={updatePassword} className="grid gap-4">
          <PasswordField
            name="password"
            label="סיסמה חדשה"
            value={newPassword}
            onChange={setNewPassword}
            error={fieldError(updateState, "password")}
          />
          <PasswordField
            name="passwordConfirm"
            label="אימות הסיסמה החדשה"
            value={newPasswordConfirm}
            onChange={setNewPasswordConfirm}
            showMeter={false}
            error={mismatch ? "שתי הסיסמאות אינן זהות." : fieldError(updateState, "passwordConfirm")}
          />
          <button type="submit" disabled={updatePending || mismatch} className="button-primary min-h-13 w-full" aria-busy={updatePending}>
            {updatePending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            {updatePending ? "מעדכנים את הסיסמה..." : "עדכון הסיסמה וכניסה"}
          </button>
        </form>
      </div>
    );
  }

  // ── שלב הטופס הראשי ──────────────────────────────────────────────────────
  const activeState = mode === "login" ? loginState : mode === "signup" ? signupState : resetReqState;
  const activePending = mode === "login" ? loginPending : mode === "signup" ? signupPending : resetReqPending;
  const signupMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">{headings[mode].title}</h1>
        <p className="mt-1.5 text-[#607087]">{headings[mode].description}</p>
      </div>

      {mode !== "forgot" && (
        <div role="tablist" aria-label="בחירת מצב: כניסה או הרשמה" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f3f7] p-1">
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

      {formError(activeState) && (
        <FormAlert tone="error" retryAfterSeconds={activeState && !activeState.ok ? activeState.retryAfterSeconds : undefined}>
          {formError(activeState)}
        </FormAlert>
      )}
      {activeState?.ok && activeState.message && !activeState.step && <FormAlert tone="success">{activeState.message}</FormAlert>}

      {mode === "signup" && (
        <p className="text-xs leading-5 text-[#78859a]">
          שדות המסומנים <span className="required-field">חובה</span> נדרשים להשלמת ההרשמה.
        </p>
      )}

      {/* ── כניסה: אימייל וסיסמה בלבד ─────────────────────────────────────── */}
      {mode === "login" && (
        <form action={login} className="grid gap-4">
          <input type="hidden" name="next" value={successTarget} />

          <Field label="כתובת אימייל" required error={fieldError(loginState, "email")}>
            {(field) => (
              <input
                {...field}
                className={inputClass(Boolean(fieldError(loginState, "email")))}
                name="email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <PasswordField
            name="password"
            label="סיסמה"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            showMeter={false}
            error={fieldError(loginState, "password")}
          />

          <div className="flex justify-end">
            <button type="button" onClick={() => switchMode("forgot")} className="min-h-11 px-1 text-sm font-semibold text-[#6d4aff] underline underline-offset-2">
              שכחתי את הסיסמה
            </button>
          </div>

          <button type="submit" disabled={activePending} className="button-primary min-h-13 w-full" aria-busy={loginPending}>
            {loginPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            {loginPending ? "נכנסים למערכת..." : "כניסה למערכת"}
          </button>
        </form>
      )}

      {/* ── הרשמה ─────────────────────────────────────────────────────────── */}
      {mode === "signup" && (
        <form action={signup} className="grid gap-4">
          <input type="hidden" name="plan" value={plan} />

          <Field label="שם מלא" required error={fieldError(signupState, "fullName")} hint="כך נפנה אליך במערכת ובמיילים">
            {(field) => (
              <input
                {...field}
                className={inputClass(Boolean(fieldError(signupState, "fullName")))}
                name="fullName"
                autoComplete="name"
                placeholder="ישראל ישראלי"
                minLength={2}
                maxLength={80}
              />
            )}
          </Field>

          <Field
            label="כתובת אימייל"
            required
            error={fieldError(signupState, "email")}
            hint="לכאן יישלח קוד האימות, וגם התראות על פניות חדשות"
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(Boolean(fieldError(signupState, "email")))}
                name="email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <PasswordField
            name="password"
            value={password}
            onChange={setPassword}
            error={fieldError(signupState, "password")}
          />

          <PasswordField
            name="passwordConfirm"
            label="אימות סיסמה"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            showMeter={false}
            error={signupMismatch ? "שתי הסיסמאות אינן זהות." : fieldError(signupState, "passwordConfirm")}
            success={!signupMismatch && passwordConfirm.length > 0 ? "הסיסמאות תואמות" : undefined}
          />

          <div className="grid gap-1.5">
            <label className="flex items-start gap-2.5 text-xs leading-5 text-[#607087]">
              <input
                type="checkbox"
                name="terms"
                value="accepted"
                className="mt-0.5 h-4.5 w-4.5 shrink-0"
                aria-required="true"
                aria-invalid={Boolean(fieldError(signupState, "terms"))}
                aria-describedby={fieldError(signupState, "terms") ? "terms-error" : undefined}
              />
              <span>
                קראתי ואני מאשר/ת את{" "}
                <Link href="/legal/terms" className="font-semibold text-[#6d4aff] underline underline-offset-2">תנאי השימוש</Link>
                {" "}ואת{" "}
                <Link href="/legal/privacy" className="font-semibold text-[#6d4aff] underline underline-offset-2">מדיניות הפרטיות</Link>
                <span className="required-field">חובה</span>
              </span>
            </label>
            {fieldError(signupState, "terms") && (
              <p id="terms-error" role="alert" className="text-xs font-semibold text-[#a32031]">
                {fieldError(signupState, "terms")}
              </p>
            )}
          </div>

          <button type="submit" disabled={activePending} className="button-primary min-h-13 w-full" aria-busy={signupPending}>
            {signupPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
            {signupPending ? "פותחים חשבון..." : "פתיחת חשבון ושליחת קוד אימות"}
            {!signupPending && <ArrowLeft size={16} aria-hidden="true" />}
          </button>

          <p className="text-center text-xs leading-5 text-[#7c8799]">
            הסיסמה לעולם אינה נשלחת במייל. נשלח קוד אימות בן 6 ספרות בלבד.
          </p>
        </form>
      )}

      {/* ── שחזור סיסמה ───────────────────────────────────────────────────── */}
      {mode === "forgot" && (
        <form action={requestReset} className="grid gap-4">
          <Field
            label="כתובת האימייל שלך"
            required
            error={fieldError(resetReqState, "email")}
            hint="נשלח לכתובת הזו קוד אימות בן 6 ספרות"
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(Boolean(fieldError(resetReqState, "email")))}
                name="email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <button type="submit" disabled={activePending} className="button-primary min-h-13 w-full" aria-busy={resetReqPending}>
            {resetReqPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
            {resetReqPending ? "שולחים קוד..." : "שליחת קוד אימות"}
          </button>

          <button type="button" onClick={() => switchMode("login")} className="button-ghost min-h-12 w-full">
            <ArrowRight size={16} aria-hidden="true" />חזרה לכניסה
          </button>
        </form>
      )}
    </div>
  );
}

function StepHeader({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d8d0ff] bg-[#f7f5ff] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-[#4636a6]">{icon}{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#6d5fb8]">{body}</p>
    </div>
  );
}

function Email({ value }: { value: string }) {
  return <span dir="ltr" className="font-semibold">{value}</span>;
}
