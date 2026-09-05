import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.9fr_1.1fr]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[470px]">
          <Logo />
          <div className="mt-12"><h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h1><p className="mt-2 text-[#607087]">{description}</p></div>
          <div className="mt-8">{children}</div>
          <div className="mt-7 text-center text-sm text-[#607087]">{footer}</div>
          <Link href="/" className="mt-7 block text-center text-sm font-semibold text-[#6d4aff]">חזרה לאתר</Link>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#0b1020] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#6d4aff]/35 blur-2xl" />
        <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-[#14d9c4]/20 blur-2xl" />
        <div className="relative max-w-xl"><span className="eyebrow border-white/10 bg-white/10 text-[#76ebda]">נבנה בשביל בעלי עסקים</span><h2 className="mt-6 text-5xl font-black leading-[1.1] tracking-[-0.05em]">הופכים כל מפגש להזדמנות עסקית.</h2><p className="mt-5 text-lg leading-8 text-[#b5c0d1]">כרטיס אחד שמתעדכן תמיד, נראה מצוין בכל מכשיר ומרכז את הפעולות החשובות ללקוח.</p></div>
        <div className="relative grid gap-3 text-sm text-[#d9e0ea]">
          {["בניית כרטיס ללא ידע טכני", "קישור ו‑QR שנשארים קבועים", "נתוני צפייה, לחיצות ופניות", "ממשק מלא בעברית וב‑RTL"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] p-4"><Check size={17} className="text-[#5ee2d0]" />{item}</div>)}
        </div>
      </aside>
    </main>
  );
}
