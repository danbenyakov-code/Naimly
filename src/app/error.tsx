"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-[#f4f6fa] p-4"><div className="card-surface w-full max-w-lg p-8 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff0f2] text-2xl text-[#b7293a]">!</span><h1 className="mt-5 text-2xl font-black">משהו השתבש</h1><p className="mt-2 text-[#68758a]">הפעולה לא הושלמה. אפשר לנסות שוב מבלי לאבד את החשבון.</p><div className="mt-6 flex justify-center gap-2"><button type="button" className="button-primary" onClick={reset}>ניסיון נוסף</button><Link href="/" className="button-secondary">דף הבית</Link></div>{error.digest && <p className="mt-4 text-[11px] text-[#9aa4b4]">מזהה תקלה: {error.digest}</p>}</div></main>;
}
