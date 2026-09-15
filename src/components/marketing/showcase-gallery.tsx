import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

/**
 * גלריית כרטיסי הדוגמה (REQ-007).
 *
 * הדרישה היא שלושה כרטיסים שנטענים בפועל, בלי פרטי דמה ועם פעולות
 * בטוחות. דף הבית הציג קודם את אותו כרטיס שלוש פעמים — בגיבור,
 * במגרש המשחקים ובהדגמה החיה — וזה אינו שלושה כרטיסים.
 *
 * כל אחד מהם הוא שורה אמיתית במסד עם כתובת ציבורית משלו, מנוהל על ידי
 * NAIMLY ומסומן ככרטיס דוגמה. הפעולות מובילות לערוצי הקשר האמיתיים
 * שלנו, ולכן אין כאן קישור שנראה חי ואינו מגיע לשום מקום.
 */
const showcases = [
  {
    slug: "noa-design",
    title: "הכרטיס של NAIMLY",
    description: "מסלולים, שעות פעילות וטופס פנייה. זה הכרטיס שאנחנו עצמנו משתמשים בו.",
    tone: "from-[#6d4aff] to-[#14d9c4]",
    highlight: "מסלולים ומחירים",
  },
  {
    slug: "naimly-studio",
    title: "מבנה לעסק ויזואלי",
    description: "גלריה בראש הכרטיס, שירותים מתחת, ופנייה בלחיצה אחת.",
    tone: "from-[#c2410c] to-[#f59e0b]",
    highlight: "גלריה ראשית",
  },
  {
    slug: "naimly-consult",
    title: "מבנה לעסק שירותים",
    description: "מה מקבלים וכמה זה עולה בראש הכרטיס, ואחריהם שעות ופנייה.",
    tone: "from-[#0f766e] to-[#22d3ee]",
    highlight: "שירותים ומחירים",
  },
];

export function ShowcaseGallery() {
  return (
    <section id="examples" className="scroll-mt-20 py-16 sm:py-24">
      <div className="container-shell">
        <Reveal className="text-center">
          <span className="eyebrow">כרטיסים חיים</span>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-[1.15] tracking-[-0.05em] sm:text-5xl">
            שלושה מבנים. אותו כלי.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#607087]">
            כל אחד מהם כרטיס אמיתי שנטען בכתובת משלו. אפשר ללחוץ, לשמור איש קשר
            ואפילו לשלוח פנייה — הכול עובד.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {showcases.map((card, index) => (
            <Reveal
              key={card.slug}
              as="article"
              delay={index * 90}
              className="card-surface flex h-full flex-col overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(11,24,48,.12)]"
            >
              <div className={`bg-gradient-to-l ${card.tone} px-5 py-6 text-white`}>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">{card.highlight}</span>
                <h3 className="mt-3 text-xl font-extrabold">{card.title}</h3>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <p className="flex-1 text-sm leading-7 text-[#5f6d83]">{card.description}</p>
                <p className="mt-3 text-xs text-[#8b96a8]" dir="ltr">naimly.co.il/{card.slug}</p>

                <Link
                  href={`/${card.slug}`}
                  className="button-secondary mt-4 min-h-12 w-full"
                  // כרטיס חי נפתח בלשונית נפרדת, כדי שדף הבית יישאר פתוח.
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  צפייה בכרטיס
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={280} className="mt-8 text-center">
          <Link href="/signup" className="button-primary min-h-13 px-7">
            לבנות כרטיס כזה
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
