import { brand } from "@/lib/config";
import { badgeHref } from "@/lib/attribution";

/**
 * תג "נבנה ב־NAIMLY" בתחתית הכרטיס הציבורי.
 *
 * עדין בכוונה: קטן, שקוף למחצה, ובלי צבע מותג חזק, כדי לא להתחרות בעסק.
 * הגוון נגזר מהרקע: על רקע כהה התג בהיר, ועל רקע בהיר הוא כהה.
 * הקישור נושא utm_campaign = הכתובת של הכרטיס, כדי לייחס הרשמות לכרטיס.
 */
export function NaimlyBadge({ slug, foreground, label, onClick }: {
  slug: string;
  /** צבע הטקסט שמתאים לרקע של הכרטיס. */
  foreground: "dark" | "light";
  /** "נבנה ב־" / "Built with". */
  label: string;
  onClick?: () => void;
}) {
  const onDark = foreground === "light";
  return (
    <a
      href={badgeHref(slug)}
      onClick={onClick}
      className={`group inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition ${
        onDark
          ? "border-white/15 bg-white/10 hover:bg-white/20"
          : "border-white/70 bg-white/65 shadow-sm hover:bg-white/90"
      }`}
    >
      <span aria-hidden="true" className="relative grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-[#0b1020] text-[10px] font-extrabold text-white">
        <span className="relative z-10 tracking-[-0.08em]">{brand.shortName}</span>
        <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-[#14d9c4]" />
      </span>
      {/* הצבעים על span פנימי: הכלל הגלובלי a { color: inherit } גובר על מחלקות שעל הקישור עצמו. */}
      <span className={onDark ? "text-white/75 group-hover:text-white" : "text-[#5f6d83] group-hover:text-[#18243a]"}>
        {label}<strong className={`font-extrabold tracking-[0.04em] ${onDark ? "text-white" : "text-[#0b1020]"}`}>{brand.name}</strong>
      </span>
    </a>
  );
}
