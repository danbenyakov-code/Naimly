import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function LegalPage({ eyebrow, title, updated = "4 בספטמבר 2026", children }: { eyebrow: string; title: string; updated?: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-white"><SiteHeader /><main><header className="border-b border-[#e2e6ee] bg-[#f5f7fb] py-14 sm:py-20"><div className="container-shell max-w-4xl"><span className="eyebrow">{eyebrow}</span><h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">{title}</h1><p className="mt-3 text-sm text-[#758198]">עדכון אחרון: {updated}</p></div></header><article className="container-shell max-w-4xl py-12 text-[#46556c] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-[#142038] [&_li]:mb-2 [&_p]:mb-4 [&_p]:leading-8 [&_ul]:mr-5 [&_ul]:list-disc">{children}</article></main><SiteFooter /></div>;
}
