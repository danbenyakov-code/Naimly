"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { marketingNav } from "@/lib/config";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#e6eaf1]/90 bg-white/90 backdrop-blur-xl">
      <div className="container-shell flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[0.92rem] font-medium text-[#526078] md:flex" aria-label="ניווט ראשי">
          {marketingNav.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[#5134cc]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="button-ghost">כניסה</Link>
          <Link href="/signup" className="button-primary">מתחילים בחינם</Link>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-xl border border-[#dfe5ef] bg-white md:hidden"
          type="button"
          aria-expanded={open}
          aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[#e6eaf1] bg-white p-4 md:hidden" aria-label="ניווט במובייל">
          <div className="container-shell grid gap-1">
            {marketingNav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl px-3 py-3 font-medium hover:bg-[#f4f2ff]" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e6eaf1] pt-4">
              <Link href="/login" className="button-secondary" onClick={() => setOpen(false)}>כניסה</Link>
              <Link href="/signup" className="button-primary" onClick={() => setOpen(false)}>מתחילים</Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
