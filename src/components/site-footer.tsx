import Link from "next/link";
import { Logo } from "@/components/logo";
import { brand } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dfe5ef] bg-white py-12">
      <div className="container-shell grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-7 text-[#607087]">כרטיס ביקור דיגיטלי שבנוי להיראות מצוין, להיות קל לעדכון ולספר לך מה באמת מעניין את הלקוחות.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold">המוצר</h2>
          <div className="grid gap-2.5 text-sm text-[#607087]">
            <Link href="/pricing">מחירים</Link>
            <Link href="/noa-design">כרטיס לדוגמה</Link>
            <Link href="/login">כניסה למערכת</Link>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold">מידע ושקיפות</h2>
          <div className="grid gap-2.5 text-sm text-[#607087]">
            <Link href="/legal/terms">תנאי שימוש</Link>
            <Link href="/legal/privacy">מדיניות פרטיות</Link>
            <Link href="/legal/cookies">מדיניות עוגיות</Link>
            <Link href="/legal/acceptable-use">מדיניות שימוש מותר</Link>
            <Link href="/legal/refund">ביטול והחזרים</Link>
            <Link href="/accessibility">הצהרת נגישות</Link>
            <a href={`mailto:${brand.supportEmail}`}>יצירת קשר</a>
          </div>
        </div>
      </div>
      <div className="container-shell mt-10 border-t border-[#edf0f5] pt-6 text-xs text-[#7b8799]">© {new Date().getFullYear()} {brand.name}. כל הזכויות שמורות.</div>
    </footer>
  );
}
