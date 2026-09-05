import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "התשלום התקבל", robots: { index: false, follow: false } };

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(20, 217, 196,.2),transparent_34%),#f4f6fa] p-4"><div className="card-surface w-full max-w-lg p-7 text-center sm:p-10"><div className="flex justify-center"><Logo /></div><span className="mx-auto mt-9 grid h-20 w-20 place-items-center rounded-full bg-[#e9fbf7] text-[#08735f]"><Check size={38} /></span><h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">{params.demo ? "תהליך התשלום הושלם בהדגמה" : "התשלום התקבל בהצלחה"}</h1><p className="mt-3 leading-7 text-[#68758a]">{params.demo ? "לא בוצע חיוב. לאחר חיבור ספק הסליקה, אישור המנוי יתבצע אוטומטית דרך Webhook מאובטח." : "המנוי יעודכן בדקות הקרובות ויישלח אליך אישור במייל."}</p><Link href="/dashboard" className="button-primary mt-7 w-full">מעבר לאזור האישי</Link></div></main>;
}
