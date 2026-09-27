import { ArrowUpLeft } from "lucide-react";
import { socialLinks, type SocialId } from "@/lib/config";
import { cn } from "@/lib/utils";

/*
 * lucide הסירה את אייקוני המותגים, ולכן הלוגואים כאן כ-SVG מוטמע
 * (הנתיבים של טיקטוק ופייסבוק לפי Simple Icons). כולם ב-currentColor,
 * כדי שהצבע ייקבע מהמשבצת שעוטפת אותם.
 */
function SocialGlyph({ id, size = 22 }: { id: SocialId; size?: number }) {
  if (id === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.3" />
        <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "tiktok") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

/** צבעי המותג של כל רשת — למשבצת האייקון ולהילה ב-hover. */
const tone: Record<SocialId, { tile: string; glow: string }> = {
  instagram: { tile: "bg-[linear-gradient(45deg,#f9a13a,#ee2a7b_45%,#8a3ab9)]", glow: "group-hover:shadow-[0_22px_50px_rgba(238,42,123,.22)]" },
  tiktok: { tile: "bg-[#0f0f12] shadow-[inset_-2px_-2px_0_#25f4ee,inset_2px_2px_0_#fe2c55]", glow: "group-hover:shadow-[0_22px_50px_rgba(37,244,238,.22)]" },
  facebook: { tile: "bg-[#1877f2]", glow: "group-hover:shadow-[0_22px_50px_rgba(24,119,242,.22)]" },
};

/** כרטיסים גדולים — לאזור הרשתות בדף הבית. */
export function SocialCards({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {socialLinks.map((social) => (
        <li key={social.id}>
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${social.label} — ${social.handle} (נפתח בלשונית חדשה)`}
            className={cn(
              "group flex h-full items-center gap-4 rounded-[26px] border border-[#e1e6ee] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-transparent sm:flex-col sm:items-start sm:p-7",
              tone[social.id].glow,
            )}
          >
            <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white transition duration-300 group-hover:scale-105", tone[social.id].tile)}>
              <SocialGlyph id={social.id} size={26} />
            </span>
            <span className="min-w-0 flex-1 sm:mt-2">
              <strong className="block text-lg font-extrabold">{social.label}</strong>
              <span dir="ltr" className="block text-sm text-[#6b778d]">{social.handle}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#6d4aff] sm:mt-auto">
              <span className="hidden sm:inline">לעמוד שלנו</span>
              <ArrowUpLeft size={17} className="transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** שורת אייקונים עגולים — לראש דף צור קשר, שם הכרטיס המלא רחוק מדי בנייד. */
export function SocialIconRow({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center justify-center gap-3", className)}>
      {socialLinks.map((social) => (
        <li key={social.id}>
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${social.label} (נפתח בלשונית חדשה)`}
            title={social.label}
            className="block rounded-full shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* הצבע על span פנימי: הכלל הגלובלי a { color: inherit } גובר על text-white שעל הקישור עצמו. */}
            <span className={cn("grid h-11 w-11 place-items-center rounded-full text-white", tone[social.id].tile)}>
              <SocialGlyph id={social.id} size={19} />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** שורות קומפקטיות — לכרטיס "עקבו אחרינו" בדף צור קשר. */
export function SocialList() {
  return (
    <ul className="mt-3 grid gap-2 text-sm">
      {socialLinks.map((social) => (
        <li key={social.id}>
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-[#f6f7fa]"
          >
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition group-hover:scale-105", tone[social.id].tile)}>
              <SocialGlyph id={social.id} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{social.label}</span>
              <span dir="ltr" className="block text-right text-xs text-[#78859a]">{social.handle}</span>
            </span>
            <ArrowUpLeft size={16} className="shrink-0 text-[#a1aaba] transition group-hover:text-[#6d4aff]" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
