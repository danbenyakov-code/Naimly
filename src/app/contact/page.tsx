import type { Metadata } from "next";
import { Clock3, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/config";
import { whatsappTo } from "@/lib/payments";

export const metadata: Metadata = {
  title: "צרו קשר",
  description: "שאלה, תקלה, בקשת הדרכה או רעיון לשיפור — כותבים לנו ואנחנו חוזרים תוך יום עסקים.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const params = await searchParams;
  const whatsappUrl = brand.supportWhatsapp ? whatsappTo(brand.supportWhatsapp, `היי ${brand.name}, יש לי שאלה.`) : "";

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main id="contact-main">
        <section className="bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.16),transparent_42%),#f6f7fb] py-12 sm:py-20">
          <div className="container-shell text-center">
            <span className="eyebrow">כאן בשבילכם</span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-5xl">איך אפשר לעזור?</h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-[#607087] sm:text-lg">
              בוחרים נושא, כותבים בקצרה — ואנחנו חוזרים אליכם. בדרך כלל תוך יום עסקים אחד.
            </p>

            <div className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="button-primary min-h-12 flex-1">
                  <MessageCircle size={18} aria-hidden="true" />וואטסאפ
                </a>
              )}
              <a href={`mailto:${brand.supportEmail}`} className="button-secondary min-h-12 flex-1">
                <Mail size={18} aria-hidden="true" />מייל
              </a>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-16">
          <div className="container-shell grid gap-8 lg:grid-cols-[1.35fr_.65fr]">
            <div className="card-surface p-5 sm:p-8">
              <ContactForm defaultTopic={params.topic} supportEmail={brand.supportEmail} />
            </div>

            <aside className="grid content-start gap-4">
              <div className="card-surface p-5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]">
                  <Clock3 size={21} aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-extrabold">זמני מענה</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-[#68758a]">תקלה טכנית</dt><dd className="font-bold">עד 4 שעות עבודה</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#68758a]">מכירות</dt><dd className="font-bold">עד יום עסקים</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#68758a]">שאר הנושאים</dt><dd className="font-bold">1–2 ימי עסקים</dd></div>
                </dl>
              </div>

              <div className="card-surface p-5">
                <h2 className="font-extrabold">פרטי קשר ישירים</h2>
                <ul className="mt-3 grid gap-3 text-sm">
                  <li>
                    <a href={`mailto:${brand.supportEmail}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[#f6f7fa]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f3f7] text-[#53627a]">
                        <Mail size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">מייל</span>
                        <span dir="ltr" className="block break-all text-xs text-[#78859a]">{brand.supportEmail}</span>
                      </span>
                    </a>
                  </li>
                  {whatsappUrl && (
                    <li>
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl p-2 hover:bg-[#f6f7fa]">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9fbf7] text-[#08735f]">
                          <MessageCircle size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">וואטסאפ</span>
                          <span className="block text-xs text-[#78859a]">מענה מהיר בצ׳אט</span>
                        </span>
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
