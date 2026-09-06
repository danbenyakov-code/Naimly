"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, PartyPopper, QrCode, Rocket, Share2, UserPlus, WandSparkles } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { burst, fireworks } from "@/lib/celebrate";
import { TRIAL_DAYS } from "@/lib/plan-access";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: UserPlus,
    title: "נרשמים בדקה",
    body: `פותחים חשבון עם אימייל וסיסמה. ${TRIAL_DAYS} יום עם כל היכולות פתוחות, בלי כרטיס אשראי.`,
    detail: "אימות בקוד בן 6 ספרות שנשלח למייל",
  },
  {
    icon: WandSparkles,
    title: "בונים מבלוקים",
    body: "גוררים רכיבים, בוחרים צבעים ורואים את התוצאה בזמן אמת — בלי שורת קוד אחת.",
    detail: "פעולות מהירות, גלריה, שירותים, המלצות וטופס פניות",
  },
  {
    icon: Share2,
    title: "מפרסמים ומשתפים",
    body: "מקבלים קישור אישי קבוע ו‑QR להדפסה. הכרטיס מתעדכן — הקישור לא משתנה לעולם.",
    detail: "שיתוף בוואטסאפ, במייל או בסריקה",
  },
  {
    icon: Rocket,
    title: "רואים מה עובד",
    body: "כל צפייה, לחיצה ופנייה נמדדות. יודעים בדיוק מאיפה מגיעים הלקוחות.",
    detail: "דוחות צפיות, פעולות והמרות",
  },
];

export function HowItWorks() {
  const [done, setDone] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function celebrate() {
    setDone(true);
    burst(buttonRef.current, { count: 110, power: 11 });
    fireworks({ bursts: 4 });
    window.setTimeout(() => setDone(false), 3200);
  }

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[#0b1020] py-16 text-white sm:py-24">
      <div className="container-shell">
        <Reveal className="text-center">
          <span className="eyebrow border-white/10 bg-white/10 text-[#76ebda]">איך זה עובד</span>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-[1.15] tracking-[-0.05em] sm:text-5xl">
            מרעיון לכרטיס חי — בארבעה צעדים.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#b5c0d1] sm:text-lg">
            בלי מתכנת, בלי מעצב, בלי לחכות לאף אחד. רוב העסקים מסיימים תוך פחות מרבע שעה.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} as="li" delay={index * 110} className="relative">
                <div className="group h-full rounded-3xl border border-white/10 bg-white/[.055] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#6d4aff]/60 hover:bg-white/[.09]">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d4aff,#14d9c4)] text-white shadow-[0_10px_30px_rgba(109,74,255,.4)] transition-transform duration-300 group-hover:scale-110">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="text-4xl font-black text-white/10" aria-hidden="true">{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#b5c0d1]">{step.body}</p>
                  <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-[#8f9cb0]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[#5ee2d0]" aria-hidden="true" />
                    {step.detail}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>

        {/* כפתור החגיגה — נותן טעימה מהתחושה של "פרסמתי!" */}
        <Reveal delay={220} className="mt-12 text-center">
          <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[.055] p-6 sm:p-8">
            <p className="text-sm font-bold text-[#76ebda]">רוצים להרגיש איך זה?</p>
            <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">
              {done ? "ככה זה מרגיש לפרסם 🎉" : "לחצו על הכפתור"}
            </h3>
            <button
              ref={buttonRef}
              type="button"
              onClick={celebrate}
              className={cn(
                "button-primary mt-5 min-h-13 w-full transition-transform duration-200 active:scale-95",
                done && "bg-[#0a9b81] border-[#0a9b81]",
              )}
            >
              {done ? <Check size={18} aria-hidden="true" /> : <PartyPopper size={18} aria-hidden="true" />}
              {done ? "הכרטיס פורסם!" : "פרסום הכרטיס"}
            </button>
            <p className="mt-3 text-xs text-[#8f9cb0]">זו רק הדגמה — לחיצה אמיתית עושה בדיוק את זה.</p>
          </div>
        </Reveal>

        <Reveal delay={300} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="button-primary min-h-13">
            התחלה — {TRIAL_DAYS} יום חינם<ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <Link href="/noa-design" className="button-secondary min-h-13 border-white/20 bg-white/10 text-white hover:bg-white/15">
            <QrCode size={17} aria-hidden="true" />לצפייה בכרטיס לדוגמה
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
