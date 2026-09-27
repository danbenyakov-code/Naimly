import Link from "next/link";
import { Logo } from "@/components/logo";
import { SocialIconRow } from "@/components/social-links";
import { brand } from "@/lib/config";

const productLinks = [
  { href: "/pricing", label: "מחירים" },
  { href: "/noa-design", label: "כרטיס לדוגמה" },
  { href: "/#faq", label: "שאלות נפוצות" },
  { href: "/contact", label: "צור קשר" },
  { href: "/login", label: "כניסה למערכת" },
];

const legalLinks = [
  { href: "/legal/terms", label: "תנאי שימוש" },
  { href: "/legal/privacy", label: "מדיניות פרטיות" },
  { href: "/legal/cookies", label: "מדיניות עוגיות" },
  { href: "/legal/acceptable-use", label: "שימוש מותר" },
  { href: "/legal/refund", label: "ביטול והחזרים" },
  { href: "/accessibility", label: "הצהרת נגישות" },
];

/*
 * מובייל תחילה: בנייד שתי קבוצות הקישורים יושבות זו לצד זו (ולא בטור
 * אחד ארוך), וכל קישור בגובה 44px לפחות — יעד לחיצה נוח לאצבע.
 * מ-md ומעלה המותג והרשתות תופסים עמודה רחבה משלהם.
 * צבע ה-hover על span פנימי: הכלל הגלובלי a { color: inherit } גובר על מחלקה שעל הקישור.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#dfe5ef] bg-white pb-28 pt-10 sm:pb-10 sm:pt-12">
      <div className="container-shell grid gap-9 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-7 text-[#607087]">כרטיס ביקור דיגיטלי ומיני סייט לעסקים — נראה מצוין, מתעדכן בשנייה ומראה לך מה באמת מביא פניות.</p>

          <div className="mt-6">
            <h2 className="text-sm font-extrabold">בואו נהיה בקשר</h2>
            <p className="mt-1 text-xs text-[#7b8799]">טיפים, השראה ועדכונים — קודם כל ברשתות.</p>
            <SocialIconRow align="start" className="mt-3" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 md:contents">
          <nav aria-label="המוצר">
            <h2 className="mb-1 text-sm font-bold">המוצר</h2>
            <ul className="text-sm text-[#607087]">
              {productLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="group flex min-h-11 items-center md:min-h-9"><span className="transition group-hover:text-[#5134cc]">{link.label}</span></Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="מידע ושקיפות">
            <h2 className="mb-1 text-sm font-bold">מידע ושקיפות</h2>
            <ul className="text-sm text-[#607087]">
              {legalLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="group flex min-h-11 items-center md:min-h-9"><span className="transition group-hover:text-[#5134cc]">{link.label}</span></Link></li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="container-shell mt-8 flex flex-col gap-2 border-t border-[#edf0f5] pt-6 text-xs text-[#7b8799] sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} {brand.name}. כל הזכויות שמורות.</span>
        <a href={`mailto:${brand.supportEmail}`} dir="ltr" className="group inline-flex min-h-11 items-center self-start sm:min-h-0 sm:self-auto"><span className="transition group-hover:text-[#5134cc]">{brand.supportEmail}</span></a>
      </div>
    </footer>
  );
}
