"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePasswordAction } from "@/app/(auth)/actions";
import { PasswordField } from "@/components/auth/password-field";
import { evaluatePassword } from "@/lib/password";
import { burst } from "@/lib/celebrate";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, submit, pending] = useActionState(updatePasswordAction, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const strength = evaluatePassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  useEffect(() => {
    if (state?.ok && state.next) {
      burst(undefined, { count: 70 });
      router.push(state.next);
    }
  }, [state, router]);

  return (
    <form action={submit} className="grid gap-4">
      {state && !state.ok && (
        <p role="alert" className="rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm font-semibold text-[#a32031]">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{state.message}</p>
      )}

      <PasswordField
        name="password"
        label="סיסמה חדשה"
        value={password}
        onChange={setPassword}
        error={state && !state.ok && state.field === "password" ? state.error : undefined}
      />

      <PasswordField
        name="passwordConfirm"
        label="אימות סיסמה"
        value={confirm}
        onChange={setConfirm}
        showMeter={false}
        error={mismatch ? "הסיסמאות אינן תואמות" : undefined}
      />

      <button type="submit" disabled={pending || !strength.valid || mismatch} className="button-primary min-h-13 w-full">
        {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
        {pending ? "מעדכנים..." : "עדכון הסיסמה"}
      </button>
    </form>
  );
}
