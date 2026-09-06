"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Play, Smartphone } from "lucide-react";
import { CardPreview } from "@/components/card/card-preview";
import { Reveal } from "@/components/ui/reveal";
import type { CardData } from "@/lib/types";

/**
 * הדגמה חיה: הכרטיס האמיתי בתוך מסגרת טלפון, לצד סרטון הסבר.
 * כשלא הוגדר סרטון (NEXT_PUBLIC_DEMO_VIDEO_ID) מוצג במקומו מסך פתיחה
 * שמוביל לכרטיס החי — במקום נגן ריק שלא עושה כלום.
 */
export function LiveDemo({ card, videoId }: { card: CardData; videoId?: string }) {
  const [playing, setPlaying] = useState(false);
  const hasVideo = Boolean(videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId));

  return (
    <section id="live-demo" className="scroll-mt-20 bg-[linear-gradient(180deg,#f6f7fb,#ffffff)] py-16 sm:py-24">
      <div className="container-shell">
        <Reveal className="text-center">
          <span className="eyebrow">הדגמה חיה</span>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-[1.15] tracking-[-0.05em] sm:text-5xl">
            ככה זה נראה אצל הלקוח.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#607087] sm:text-lg">
            זה כרטיס אמיתי ופעיל — אפשר ללחוץ, לגלול ולנסות את הכפתורים.
          </p>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr]">
          {/* מסגרת טלפון עם הכרטיס האמיתי */}
          <Reveal direction="scale" className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-[330px]">
              <div className="relative rounded-[38px] border-[10px] border-[#172033] bg-white shadow-[0_30px_80px_rgba(11,24,48,.25)]">
                <span aria-hidden="true" className="absolute left-1/2 top-1.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#172033]" />
                <div className="max-h-[560px] overflow-y-auto overscroll-contain rounded-[28px]">
                  <CardPreview card={card} compact />
                </div>
              </div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#78859a]">
                <Smartphone size={14} aria-hidden="true" />תצוגה אמיתית, לא תמונה
              </p>
            </div>
          </Reveal>

          {/* סרטון / הסבר */}
          <Reveal delay={140} className="order-1 lg:order-2">
            <div className="overflow-hidden rounded-3xl border border-[#dfe5ed] bg-white shadow-[0_20px_60px_rgba(11,24,48,.1)]">
              <div className="relative aspect-video bg-[linear-gradient(135deg,#0b1020,#2c2b70)]">
                {hasVideo && playing ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
                    title="סרטון הדגמה של NAIMLY"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="grid h-full place-items-center p-6 text-center text-white">
                    <div>
                      {hasVideo ? (
                        <button
                          type="button"
                          onClick={() => setPlaying(true)}
                          className="group grid h-20 w-20 place-items-center rounded-full bg-white/15 backdrop-blur transition-transform duration-300 hover:scale-110"
                          aria-label="הפעלת סרטון ההדגמה"
                        >
                          <Play size={30} className="translate-x-0.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="grid h-20 w-20 place-items-center rounded-full bg-white/15" aria-hidden="true">
                          <Play size={30} className="translate-x-0.5" />
                        </span>
                      )}
                      <p className="mt-5 text-lg font-extrabold">
                        {hasVideo ? "סרטון: מאפס לכרטיס בשלוש דקות" : "הדרך המהירה להתרשם"}
                      </p>
                      <p className="mt-1.5 text-sm text-white/60">
                        {hasVideo ? "לחצו להפעלה" : "פותחים את הכרטיס החי ומנסים בעצמכם"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                <Link href={`/${card.slug}`} target="_blank" className="button-primary min-h-13">
                  <ExternalLink size={17} aria-hidden="true" />פתיחת הכרטיס החי
                </Link>
                <Link href="/signup" className="button-secondary min-h-13">
                  לבנות כזה לעצמי<ArrowLeft size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
