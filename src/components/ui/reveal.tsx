"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * העדפת "פחות תנועה" — גם מהמערכת וגם ממתג הנגישות של האתר.
 * נקרא דרך useSyncExternalStore כדי שלא נצטרך לכתוב ל-state מתוך effect.
 */
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    query.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

const motionSnapshot = () =>
  document.documentElement.classList.contains("a11y-reduced-motion") ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// בשרת מניחים "ללא תנועה", כדי שהתוכן ייצא מלא ב-HTML ויהיה זמין תמיד.
const motionServerSnapshot = () => true;

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeMotion, motionSnapshot, motionServerSnapshot);
}

/**
 * חושף תוכן בגלילה. משתמש ב-IntersectionObserver ולא בטיימרים, כדי שהאנימציה
 * תרוץ בדיוק כשהאלמנט נכנס למסך. כשהמשתמש ביקש פחות תנועה — התוכן מוצג מיד.
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "right" | "scale";
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEntered(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  const visible = reduced || entered;
  const hidden =
    direction === "right" ? "translate-x-6 opacity-0"
    : direction === "scale" ? "scale-95 opacity-0"
    : "translate-y-6 opacity-0";

  return (
    <Tag
      ref={ref as React.Ref<never>}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        visible ? "translate-x-0 translate-y-0 scale-100 opacity-100" : hidden,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** מונה שרץ מ-0 ליעד כשנכנס למסך. משמש למספרי הוכחה חברתית. */
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;

    let raf = 0;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // האטה בסוף, כדי שהמספר "ינחת" ולא ייעצר בחדות.
          setAnimated(Math.round(to * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });

    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration, reduced]);

  const value = reduced ? to : animated;
  return <span ref={ref} className="tabular-nums">{value.toLocaleString("he-IL")}{suffix}</span>;
}
