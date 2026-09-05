import Link from "next/link";
import { brand } from "@/lib/config";

export function Logo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-xl font-extrabold" aria-label={`${brand.name} — דף הבית`}>
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[14px] bg-[#0b1020] text-lg text-white shadow-[0_8px_20px_rgba(11,16,32,.2)]">
        <span className="relative z-10 tracking-[-0.08em]">{brand.shortName}</span>
        <span className="absolute -bottom-2 -left-2 h-7 w-7 rounded-full bg-[#14d9c4]" />
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff6b61]" />
      </span>
      {!compact && <span className="leading-none"><span className="block text-[1.08rem] tracking-[0.08em] text-[#0b1020]">{brand.name}</span><span className="mt-1 block text-[0.64rem] font-semibold tracking-normal text-[#657188]">{brand.hebrewName}</span></span>}
    </Link>
  );
}
