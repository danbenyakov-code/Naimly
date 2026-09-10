"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { CountUp, Reveal } from "@/components/ui/reveal";
import { Portrait, type PortraitId } from "@/components/marketing/portrait";
import { cn } from "@/lib/utils";

/**
 * המלצות לקוחות. התוכן כאן הוא דוגמה לצורך העיצוב — יש להחליף בהמלצות
 * אמיתיות עם אישור הלקוחות לפני ההשקה.
 */
const testimonials = [
  {
    name: "נועה כהן",
    role: "מיתוג ועיצוב לעסקים",
    portrait: "noa" as PortraitId,
    rating: 5,
    text: "תוך רבע שעה היה לי כרטיס שנראה יותר טוב מהאתר שלי. מאז כל פגישה מסתיימת בסריקה של ה‑QR, ואני רואה בדיוק מי חזר אליי.",
    highlight: "פי 3 יותר פניות מהטלפון",
  },
  {
    name: "איתי ברק",
    role: "יועץ משכנתאות",
    portrait: "amir" as PortraitId,
    rating: 5,
    text: "הכי אהבתי שאני מעדכן מחיר או שירות והקישור נשאר אותו קישור. לא צריך להדפיס כרטיסים מחדש בכל שינוי.",
    highlight: "חסך לי הדפסות בכל רבעון",
  },
  {
    name: "מאיה עזר",
    role: "סטודיו לפילאטיס",
    portrait: "maya" as PortraitId,
    rating: 5,
    text: "הטופס בכרטיס מביא לי לידים גם כשאני באימון. הכול מגיע מסודר לאזור האישי ואני חוזרת אליהם בערב.",
    highlight: "לידים גם בשעות שאני לא זמינה",
  },
  {
    name: "רוני שלו",
    role: "קבלן שיפוצים",
    portrait: "roni" as PortraitId,
    rating: 5,
    text: "אני לא איש מחשבים בכלל. בניתי את הכרטיס לבד מהנייד, בלי שאף אחד יעזור לי. זה באמת פשוט.",
    highlight: "נבנה לגמרי מהנייד",
  },
];

const stats = [
  { value: 1200, suffix: "+", label: "כרטיסים פעילים" },
  { value: 94, suffix: "%", label: "ממשיכים אחרי ההתנסות" },
  { value: 15, suffix: " דק׳", label: "זמן הקמה ממוצע" },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const move = (direction: 1 | -1) =>
    setIndex((current) => (current + direction + testimonials.length) % testimonials.length);

  return (
    <section id="testimonials" className="scroll-mt-20 py-16 sm:py-24">
      <div className="container-shell">
        <Reveal className="text-center">
          <span className="eyebrow">לקוחות מספרים</span>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-[1.15] tracking-[-0.05em] sm:text-5xl">
            עסקים שכבר עברו לכרטיס חכם.
          </h2>
        </Reveal>

        {/* מספרים */}
        <Reveal delay={120}>
          <dl className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="card-surface p-5 text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <strong className="block text-3xl font-black text-[#6d4aff] sm:text-4xl">
                    <CountUp to={stat.value} suffix={stat.suffix} />
                  </strong>
                  <span className="mt-1 block text-sm text-[#68758a]">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* קרוסלה בנייד, רשת במסך רחב */}
        <div className="mt-10">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {testimonials.map((item, position) => (
              <Reveal
                key={item.name}
                as="article"
                delay={position * 90}
                className={cn(
                  "card-surface flex h-full flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(11,24,48,.12)]",
                  // בנייד מוצג רק הפריט הפעיל
                  position === index ? "block" : "hidden lg:flex",
                )}
              >
                <Quote size={26} className="text-[#d8d0ff]" aria-hidden="true" />
                <div className="mt-3 flex gap-0.5 text-[#f3a712]" aria-label={`דירוג ${item.rating} מתוך 5`}>
                  {Array.from({ length: item.rating }).map((_, star) => (
                    <Star key={star} size={15} fill="currentColor" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-3 flex-1 text-sm leading-7 text-[#4a5871]">״{item.text}״</p>
                <p className="mt-4 rounded-xl bg-[#f1efff] px-3 py-2 text-xs font-bold text-[#4b3bad]">{item.highlight}</p>
                <footer className="mt-4 flex items-center gap-3 border-t border-[#eef0f5] pt-4">
                  <Portrait id={item.portrait} size={44} className="shrink-0 rounded-full ring-2 ring-[#eae7ff]" />
                  <span className="min-w-0">
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="block text-xs text-[#78859a]">{item.role}</span>
                  </span>
                </footer>
              </Reveal>
            ))}
          </div>

          {/* פקדי ניווט — רק בנייד */}
          <div className="mt-5 flex items-center justify-center gap-3 lg:hidden">
            <button type="button" onClick={() => move(-1)} className="grid h-12 w-12 place-items-center rounded-full border border-[#dfe4ec] bg-white" aria-label="ההמלצה הקודמת">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <div className="flex gap-1.5" role="tablist" aria-label="בחירת המלצה">
              {testimonials.map((item, position) => (
                <button
                  key={item.name}
                  type="button"
                  role="tab"
                  aria-selected={position === index}
                  aria-label={`המלצה של ${item.name}`}
                  onClick={() => setIndex(position)}
                  className={cn("h-2.5 rounded-full transition-all", position === index ? "w-7 bg-[#6d4aff]" : "w-2.5 bg-[#d5d9e2]")}
                />
              ))}
            </div>
            <button type="button" onClick={() => move(1)} className="grid h-12 w-12 place-items-center rounded-full border border-[#dfe4ec] bg-white" aria-label="ההמלצה הבאה">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
