/**
 * דיוקנאות מאוירים לסקשן ההמלצות ולדף הנחיתה.
 *
 * למה איור ולא צילום: תמונות סטוק של "אנשים מחייכים" מזוהות מיד ופוגעות
 * באמון, ותמונות של לקוחות אמיתיים דורשות הסכמה. מעבר לזה ה-CSP מתיר
 * `img-src 'self' data:` בלבד, ולכן כל תמונה חיצונית תיחסם בשקט.
 *
 * האיורים הם SVG inline: אפס בקשות רשת, חדים בכל רזולוציה, ומקבלים
 * את צבעי המותג. כשיהיו צילומים אמיתיים אפשר להחליף את הרכיב במקום אחד.
 */

export type PortraitId = "noa" | "amir" | "maya" | "roni" | "yael" | "dan";

type Palette = { skin: string; hair: string; shirt: string; accent: string; bg: string };

const palettes: Record<PortraitId, Palette> = {
  noa: { skin: "#f0c9a8", hair: "#2f2438", shirt: "#6d4aff", accent: "#b9a6ff", bg: "#efeaff" },
  amir: { skin: "#d9a071", hair: "#1d1a24", shirt: "#0a9b81", accent: "#7fd8c6", bg: "#e3f6f1" },
  maya: { skin: "#f3d3b6", hair: "#7a3b1f", shirt: "#e0699b", accent: "#f6b0cb", bg: "#fdeaf2" },
  roni: { skin: "#c58b5f", hair: "#241c17", shirt: "#2f6fed", accent: "#9dbcf7", bg: "#e6eefd" },
  yael: { skin: "#f6dcc4", hair: "#4a2c1a", shirt: "#f0932b", accent: "#fbc98a", bg: "#fdf0e0" },
  dan: { skin: "#e8b98f", hair: "#3a3a3a", shirt: "#111b3b", accent: "#8892b0", bg: "#e9ecf5" },
};

/** תספורות שונות, כדי שהדמויות לא ייראו כמו אותו אדם בצבע אחר. */
function Hair({ id, color }: { id: PortraitId; color: string }) {
  if (id === "noa" || id === "maya") {
    return (
      <>
        <path d="M22 40c0-13 8-22 22-22s22 9 22 22c0 6-2 9-2 9s-2-9-6-12c-5 4-14 6-22 4-5-1-8-3-8-3s-3 4-4 11c0 0-2-3-2-9Z" fill={color} />
        <path d="M20 40c-3 10-2 22 1 30 1-9 3-16 5-21Zm48 0c3 10 2 22-1 30-1-9-3-16-5-21Z" fill={color} />
      </>
    );
  }
  if (id === "yael") {
    return (
      <>
        <path d="M23 41c0-13 9-23 21-23s21 10 21 23c0 4-1 7-1 7-2-8-6-12-6-12-6 3-17 4-25 1-4-1-6-3-6-3s-3 6-3 14c0 0-1-3-1-7Z" fill={color} />
        <circle cx="24" cy="31" r="7" fill={color} />
        <circle cx="64" cy="31" r="7" fill={color} />
      </>
    );
  }
  if (id === "roni") {
    return <path d="M24 42c0-13 8-24 20-24s20 11 20 24c0 3-1 5-1 5-1-7-3-11-5-13-7 3-19 3-27 0-2 2-5 6-6 13 0 0-1-2-1-5Z" fill={color} />;
  }
  // amir, dan — קצר
  return <path d="M25 43c0-14 8-24 19-24s19 10 19 24c0 2 0 4-1 5-1-8-4-13-6-15-6 3-18 3-25 1-2 2-4 6-5 14-1-1-1-3-1-5Z" fill={color} />;
}

function Beard({ color }: { color: string }) {
  return <path d="M30 56c0 10 6 17 14 17s14-7 14-17c0 0-4 8-14 8s-14-8-14-8Z" fill={color} opacity=".85" />;
}

/**
 * דיוקן יחיד. `label` נדרש רק כשהאיור נושא מידע בפני עצמו; בהמלצות
 * השם מופיע ממילא בטקסט, ולכן האיור מוסתר מקוראי מסך.
 */
export function Portrait({
  id,
  size = 56,
  label,
  className,
}: {
  id: PortraitId;
  size?: number;
  label?: string;
  className?: string;
}) {
  const p = palettes[id];
  const bearded = id === "amir" || id === "dan";

  return (
    <svg
      viewBox="0 0 88 88"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle cx="44" cy="44" r="44" fill={p.bg} />
      {/* כתפיים */}
      <path d="M12 88c2-16 15-25 32-25s30 9 32 25Z" fill={p.shirt} />
      <path d="M36 63c3 5 13 5 16 0l-2 25h-12Z" fill="#fff" opacity=".22" />
      {/* צוואר */}
      <path d="M37 52h14v13c0 3-14 3-14 0Z" fill={p.skin} />
      <path d="M37 58c4 3 10 3 14 0v-6H37Z" fill="#000" opacity=".08" />
      {/* פנים */}
      <ellipse cx="44" cy="42" rx="17" ry="19" fill={p.skin} />
      {/* אוזניים */}
      <circle cx="26" cy="43" r="3.5" fill={p.skin} />
      <circle cx="62" cy="43" r="3.5" fill={p.skin} />
      {/* עיניים */}
      <ellipse cx="37.5" cy="41" rx="2" ry="2.4" fill="#2a2338" />
      <ellipse cx="50.5" cy="41" rx="2" ry="2.4" fill="#2a2338" />
      {/* גבות */}
      <path d="M34 36.5c2-1.4 5-1.4 7 0" stroke={p.hair} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M47 36.5c2-1.4 5-1.4 7 0" stroke={p.hair} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* חיוך */}
      <path d="M38 49c2.5 3 9.5 3 12 0" stroke="#8a5a4a" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      {bearded && <Beard color={p.hair} />}
      <Hair id={id} color={p.hair} />
      {/* נגיעת מותג */}
      <circle cx="72" cy="20" r="6" fill={p.accent} opacity=".55" />
    </svg>
  );
}

/**
 * ערימת דיוקנאות ל"הצטרפו אלינו" — סימן חברתי בלי להמציא מספרים.
 */
export function PortraitStack({ ids, size = 38 }: { ids: PortraitId[]; size?: number }) {
  return (
    <div className="flex -space-x-3 rtl:space-x-reverse" aria-hidden="true">
      {ids.map((id) => (
        <span key={id} className="inline-grid place-items-center rounded-full ring-2 ring-white/85" style={{ width: size, height: size }}>
          <Portrait id={id} size={size} className="rounded-full" />
        </span>
      ))}
    </div>
  );
}
