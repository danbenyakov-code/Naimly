/**
 * ספריית רקעים לכרטיס.
 *
 * כל רקע הוא CSS טהור — גרדיאנטים, שכבות ותבניות — ולא תמונה. זה שומר על
 * טעינה מיידית, על חדות בכל רזולוציה ועל התאמה מדויקת בין התצוגה המקדימה
 * לכרטיס המפורסם. אין כאן שימוש בקוד, בתמונות או בעיצוב של מתחרים.
 *
 * `foreground` קובע אם הטקסט על הרקע צריך להיות כהה או בהיר. הוא משמש
 * לאזהרת ניגודיות בבונה, כדי שלא יפורסם כרטיס בלתי קריא.
 */

export type BackgroundCategory =
  | "professional"
  | "minimal"
  | "luxury"
  | "colorful"
  | "dark"
  | "light"
  | "tech"
  | "creative"
  | "gradient"
  | "geometric";

export type BackgroundPreset = {
  id: string;
  name: string;
  category: BackgroundCategory;
  /** ערך ה-background המלא. */
  css: string;
  /** האם הטקסט מעל הרקע צריך להיות בהיר או כהה. */
  foreground: "dark" | "light";
  /** מילות חיפוש נוספות בעברית. */
  keywords?: string[];
};

export const backgroundCategories: Array<{ id: BackgroundCategory; label: string }> = [
  { id: "professional", label: "מקצועי" },
  { id: "minimal", label: "מינימלי" },
  { id: "luxury", label: "יוקרה" },
  { id: "colorful", label: "צבעוני" },
  { id: "dark", label: "כהה" },
  { id: "light", label: "בהיר" },
  { id: "tech", label: "טכנולוגיה" },
  { id: "creative", label: "יצירתי" },
  { id: "gradient", label: "גרדיאנט רך" },
  { id: "geometric", label: "גאומטרי" },
];

export const backgroundPresets: BackgroundPreset[] = [
  // ── מקצועי ────────────────────────────────────────────────────────────────
  { id: "aurora", name: "אורורה", category: "professional", foreground: "dark", keywords: ["סגול", "ברירת מחדל"],
    css: "radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--public-primary) 18%,transparent),transparent 32%),#eef1f6" },
  { id: "corporate-slate", name: "אפור עסקי", category: "professional", foreground: "dark", keywords: ["אפור", "רשמי"],
    css: "linear-gradient(160deg,#f7f9fc 0%,#e8edf4 100%)" },
  { id: "trust-blue", name: "כחול אמון", category: "professional", foreground: "dark", keywords: ["כחול", "בנק"],
    css: "radial-gradient(circle at 80% 0%,#dbe9fb,transparent 45%),linear-gradient(180deg,#f5f9ff,#eaf1fa)" },
  { id: "consultant-sand", name: "חול יועץ", category: "professional", foreground: "dark", keywords: ["בז", "חם"],
    css: "linear-gradient(150deg,#fdfbf7,#f0e9de)" },
  { id: "legal-navy", name: "נייבי משפטי", category: "professional", foreground: "light", keywords: ["כחול כהה", "עורך דין"],
    css: "linear-gradient(155deg,#16233d,#0d1526)" },
  { id: "medical-mint", name: "מנטה רפואי", category: "professional", foreground: "dark", keywords: ["ירוק", "קליניקה"],
    css: "radial-gradient(circle at 20% 15%,#dcf5ee,transparent 45%),linear-gradient(180deg,#f6fbf9,#eaf4f0)" },

  // ── מינימלי ───────────────────────────────────────────────────────────────
  { id: "minimal", name: "מינימלי", category: "minimal", foreground: "dark", keywords: ["פסטל", "עדין"],
    css: "radial-gradient(circle at 15% 15%,#ffd7f1,transparent 35%),radial-gradient(circle at 85% 25%,#c5edff,transparent 40%),radial-gradient(circle at 50% 90%,#ddd2ff,transparent 45%),#f5f2ff" },
  { id: "pure-white", name: "לבן נקי", category: "minimal", foreground: "dark", keywords: ["לבן", "פשוט"],
    css: "#ffffff" },
  { id: "paper", name: "נייר", category: "minimal", foreground: "dark", keywords: ["קרם", "מודפס"],
    css: "linear-gradient(135deg,#fffdf7,#eee9df)" },
  { id: "fog", name: "ערפל", category: "minimal", foreground: "dark", keywords: ["אפור בהיר"],
    css: "linear-gradient(180deg,#fafbfc,#eef0f3)" },
  { id: "linen", name: "פשתן", category: "minimal", foreground: "dark", keywords: ["טקסטיל", "רך"],
    css: "repeating-linear-gradient(45deg,#fbfaf7,#fbfaf7 6px,#f5f3ee 6px,#f5f3ee 12px)" },
  { id: "whisper-grey", name: "אפור לחישה", category: "minimal", foreground: "dark", keywords: ["ניטרלי"],
    css: "linear-gradient(200deg,#f8f9fa,#f1f2f4)" },

  // ── יוקרה ─────────────────────────────────────────────────────────────────
  { id: "black-gold", name: "שחור וזהב", category: "luxury", foreground: "light", keywords: ["זהב", "אקסקלוסיבי"],
    css: "radial-gradient(circle at 85% 10%,rgba(212,175,55,.28),transparent 42%),linear-gradient(160deg,#111010,#050505)" },
  { id: "champagne", name: "שמפניה", category: "luxury", foreground: "dark", keywords: ["זהב בהיר", "אלגנטי"],
    css: "linear-gradient(140deg,#fdf6e8,#efdfc2)" },
  { id: "royal-purple", name: "סגול מלכותי", category: "luxury", foreground: "light", keywords: ["סגול כהה"],
    css: "radial-gradient(circle at 20% 20%,rgba(160,110,255,.35),transparent 45%),linear-gradient(150deg,#221046,#12071f)" },
  { id: "emerald-velvet", name: "קטיפה אמרלד", category: "luxury", foreground: "light", keywords: ["ירוק כהה"],
    css: "radial-gradient(circle at 75% 15%,rgba(38,166,120,.3),transparent 45%),linear-gradient(155deg,#0a2a20,#04140f)" },
  { id: "rose-marble", name: "שיש רוזה", category: "luxury", foreground: "dark", keywords: ["ורוד", "שיש"],
    css: "radial-gradient(circle at 25% 20%,#ffe7ee,transparent 45%),radial-gradient(circle at 80% 70%,#f6e2e8,transparent 40%),#fdf7f8" },
  { id: "obsidian", name: "אובסידיאן", category: "luxury", foreground: "light", keywords: ["שחור", "מבריק"],
    css: "linear-gradient(145deg,#1b1b1f,#0a0a0c 60%,#141418)" },

  // ── צבעוני ────────────────────────────────────────────────────────────────
  { id: "sunset", name: "שקיעה", category: "colorful", foreground: "dark", keywords: ["כתום", "ורוד"],
    css: "linear-gradient(135deg,#ffe0d5,#eddcff 55%,#d7f3ff)" },
  { id: "citrus", name: "הדרים", category: "colorful", foreground: "dark", keywords: ["כתום", "צהוב", "אנרגטי"],
    css: "linear-gradient(140deg,#fff4d6,#ffd9c0 55%,#ffc7d9)" },
  { id: "tropical", name: "טרופי", category: "colorful", foreground: "dark", keywords: ["ירוק", "תכלת"],
    css: "linear-gradient(135deg,#d9fbe8,#c9f0ff 60%,#e5ddff)" },
  { id: "candy", name: "סוכריה", category: "colorful", foreground: "dark", keywords: ["ורוד", "כיף"],
    css: "radial-gradient(circle at 20% 20%,#ffd6ec,transparent 45%),radial-gradient(circle at 80% 30%,#d6e8ff,transparent 45%),#fff5fb" },
  { id: "rainbow-soft", name: "קשת רכה", category: "colorful", foreground: "dark", keywords: ["צבעים", "שמח"],
    css: "linear-gradient(120deg,#ffe3e3,#fff3d6 25%,#e0fbe8 50%,#dceeff 75%,#eee0ff)" },
  { id: "coral-reef", name: "שונית אלמוגים", category: "colorful", foreground: "dark", keywords: ["אלמוג", "תכלת"],
    css: "radial-gradient(circle at 15% 80%,#ffd9d0,transparent 45%),linear-gradient(150deg,#e6f7ff,#fff0ea)" },

  // ── כהה ───────────────────────────────────────────────────────────────────
  { id: "midnight", name: "חצות", category: "dark", foreground: "light", keywords: ["כחול כהה", "לילה"],
    css: "radial-gradient(circle at 85% 10%,#4c3f91,transparent 38%),linear-gradient(145deg,#0d1323,#252044)" },
  { id: "ocean", name: "אוקיינוס", category: "dark", foreground: "light", keywords: ["טורקיז", "ים"],
    css: "radial-gradient(circle at 15% 10%,#1a9aae,transparent 35%),linear-gradient(145deg,#06172b,#12384a)" },
  { id: "charcoal", name: "פחם", category: "dark", foreground: "light", keywords: ["אפור כהה", "ניטרלי"],
    css: "linear-gradient(160deg,#26292e,#15171a)" },
  { id: "deep-forest", name: "יער עמוק", category: "dark", foreground: "light", keywords: ["ירוק", "טבע"],
    css: "radial-gradient(circle at 25% 15%,rgba(52,168,120,.22),transparent 45%),linear-gradient(150deg,#0f2019,#061109)" },
  { id: "wine", name: "יין", category: "dark", foreground: "light", keywords: ["בורדו", "אדום כהה"],
    css: "radial-gradient(circle at 80% 20%,rgba(200,60,90,.25),transparent 42%),linear-gradient(155deg,#2a0d18,#15060c)" },
  { id: "space", name: "חלל", category: "dark", foreground: "light", keywords: ["כוכבים", "סגול"],
    css: "radial-gradient(circle at 70% 25%,rgba(120,90,220,.3),transparent 40%),radial-gradient(circle at 20% 70%,rgba(40,180,200,.18),transparent 40%),linear-gradient(160deg,#080a18,#0f1226)" },

  // ── בהיר ──────────────────────────────────────────────────────────────────
  { id: "daylight", name: "אור יום", category: "light", foreground: "dark", keywords: ["לבן", "בהיר"],
    css: "linear-gradient(180deg,#ffffff,#f4f7fb)" },
  { id: "sky", name: "שמיים", category: "light", foreground: "dark", keywords: ["תכלת", "רגוע"],
    css: "linear-gradient(180deg,#f0f8ff,#dceefc)" },
  { id: "peach-soft", name: "אפרסק רך", category: "light", foreground: "dark", keywords: ["אפרסק", "חם"],
    css: "linear-gradient(160deg,#fff6f0,#ffe8dc)" },
  { id: "mint-light", name: "מנטה בהיר", category: "light", foreground: "dark", keywords: ["ירוק בהיר", "רענן"],
    css: "linear-gradient(170deg,#f2fdf8,#dff5ec)" },
  { id: "lavender-light", name: "לבנדר בהיר", category: "light", foreground: "dark", keywords: ["סגול בהיר"],
    css: "linear-gradient(165deg,#faf7ff,#ece4fb)" },
  { id: "butter", name: "חמאה", category: "light", foreground: "dark", keywords: ["צהוב רך"],
    css: "linear-gradient(150deg,#fffdf2,#faf0d4)" },

  // ── טכנולוגיה ─────────────────────────────────────────────────────────────
  { id: "circuit", name: "מעגלים", category: "tech", foreground: "light", keywords: ["שבב", "היי-טק"],
    css: "linear-gradient(#0e1424,#0e1424),repeating-linear-gradient(0deg,rgba(90,200,255,.07) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(90,200,255,.07) 0 1px,transparent 1px 28px)" },
  { id: "neon-grid", name: "רשת ניאון", category: "tech", foreground: "light", keywords: ["ניאון", "סייבר"],
    css: "radial-gradient(circle at 50% 0%,rgba(120,80,255,.35),transparent 50%),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 34px),#0a0a18" },
  { id: "data-blue", name: "כחול דאטה", category: "tech", foreground: "light", keywords: ["מידע", "כחול"],
    css: "radial-gradient(ellipse at 30% 0%,#1c4e8a,transparent 55%),linear-gradient(160deg,#08132a,#0a1730)" },
  { id: "terminal", name: "טרמינל", category: "tech", foreground: "light", keywords: ["ירוק", "קוד"],
    css: "radial-gradient(circle at 20% 20%,rgba(40,220,140,.16),transparent 45%),#0b120e" },
  { id: "chrome", name: "כרום", category: "tech", foreground: "dark", keywords: ["מטאלי", "כסף"],
    css: "linear-gradient(115deg,#f4f6f8 0%,#dfe4ea 25%,#ffffff 50%,#dfe4ea 75%,#f4f6f8 100%)" },
  { id: "hologram", name: "הולוגרמה", category: "tech", foreground: "dark", keywords: ["אירידיום", "עתידני"],
    css: "linear-gradient(120deg,#e8f6ff,#f5e8ff 30%,#e8fff4 60%,#fff3e8)" },

  // ── יצירתי ────────────────────────────────────────────────────────────────
  { id: "watercolor", name: "צבעי מים", category: "creative", foreground: "dark", keywords: ["אמנות", "רך"],
    css: "radial-gradient(circle at 20% 25%,rgba(255,150,180,.35),transparent 40%),radial-gradient(circle at 75% 20%,rgba(150,200,255,.35),transparent 40%),radial-gradient(circle at 50% 80%,rgba(180,255,210,.35),transparent 42%),#fffdfb" },
  { id: "ink-splash", name: "כתם דיו", category: "creative", foreground: "light", keywords: ["דיו", "דרמטי"],
    css: "radial-gradient(circle at 30% 30%,rgba(90,110,255,.4),transparent 38%),radial-gradient(circle at 70% 65%,rgba(255,90,160,.3),transparent 38%),#101024" },
  { id: "sunrise-studio", name: "סטודיו זריחה", category: "creative", foreground: "dark", keywords: ["זריחה", "חם"],
    css: "linear-gradient(180deg,#fff0e0 0%,#ffd9c9 45%,#ffc2d6 100%)" },
  { id: "pastel-dream", name: "חלום פסטל", category: "creative", foreground: "dark", keywords: ["פסטל", "עדין"],
    css: "linear-gradient(135deg,#fde8f3,#e8f0fd 50%,#e9fdf3)" },
  { id: "duotone-violet", name: "דואוטון סגול", category: "creative", foreground: "light", keywords: ["דואוטון"],
    css: "linear-gradient(135deg,#6d4aff,#14d9c4)" },
  { id: "canvas-texture", name: "מרקם בד", category: "creative", foreground: "dark", keywords: ["בד", "טקסטורה"],
    css: "repeating-linear-gradient(0deg,rgba(0,0,0,.018) 0 2px,transparent 2px 4px),repeating-linear-gradient(90deg,rgba(0,0,0,.018) 0 2px,transparent 2px 4px),#faf8f4" },

  // ── גרדיאנט רך ────────────────────────────────────────────────────────────
  { id: "soft-violet", name: "סגול רך", category: "gradient", foreground: "dark", keywords: ["סגול", "ענן"],
    css: "linear-gradient(160deg,#f3f0ff,#e6dcff)" },
  { id: "soft-teal", name: "טורקיז רך", category: "gradient", foreground: "dark", keywords: ["טורקיז"],
    css: "linear-gradient(160deg,#eefbfa,#d8f2f0)" },
  { id: "soft-rose", name: "רוזה רך", category: "gradient", foreground: "dark", keywords: ["ורוד"],
    css: "linear-gradient(160deg,#fff2f5,#ffe0e8)" },
  { id: "soft-amber", name: "אמבר רך", category: "gradient", foreground: "dark", keywords: ["כתום רך"],
    css: "linear-gradient(160deg,#fff8ec,#ffeccf)" },
  { id: "aurora-mesh", name: "רשת אורורה", category: "gradient", foreground: "dark", keywords: ["מש", "מודרני"],
    css: "radial-gradient(at 15% 20%,#d9e8ff 0,transparent 50%),radial-gradient(at 80% 15%,#ffe0f0 0,transparent 50%),radial-gradient(at 60% 85%,#dcfbe9 0,transparent 50%),#f8f9ff" },
  { id: "twilight-fade", name: "דמדומים", category: "gradient", foreground: "light", keywords: ["סגול כחול"],
    css: "linear-gradient(175deg,#3a2a6d,#1b1638 70%,#0f0d20)" },

  // ── גאומטרי ───────────────────────────────────────────────────────────────
  { id: "diagonal-stripes", name: "פסים אלכסוניים", category: "geometric", foreground: "dark", keywords: ["פסים"],
    css: "repeating-linear-gradient(135deg,#f7f8fb 0 14px,#eef1f7 14px 28px)" },
  { id: "dot-grid", name: "רשת נקודות", category: "geometric", foreground: "dark", keywords: ["נקודות"],
    css: "radial-gradient(circle,#dfe4ee 1.5px,transparent 1.5px) 0 0/22px 22px,#fafbfd" },
  { id: "blueprint", name: "שרטוט", category: "geometric", foreground: "dark", keywords: ["תוכנית", "אדריכל"],
    css: "repeating-linear-gradient(0deg,rgba(80,130,200,.14) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,rgba(80,130,200,.14) 0 1px,transparent 1px 24px),#f3f7fc" },
  { id: "hex-mesh", name: "משושים", category: "geometric", foreground: "dark", keywords: ["משושה", "כוורת"],
    css: "repeating-linear-gradient(60deg,rgba(120,140,180,.08) 0 1px,transparent 1px 20px),repeating-linear-gradient(-60deg,rgba(120,140,180,.08) 0 1px,transparent 1px 20px),#f7f9fc" },
  { id: "arc-layers", name: "שכבות קשת", category: "geometric", foreground: "light", keywords: ["קשתות"],
    css: "radial-gradient(circle at 50% 120%,#6d4aff 0 30%,transparent 30%),radial-gradient(circle at 50% 130%,#14d9c4 0 45%,transparent 45%),#121228" },
  { id: "checker-soft", name: "משבצות רכות", category: "geometric", foreground: "dark", keywords: ["שחמט"],
    css: "repeating-conic-gradient(#f8f9fc 0 25%,#eff2f7 0 50%) 0 0/32px 32px" },
];

/** מפה לחיפוש מהיר לפי מזהה. */
const byId = new Map(backgroundPresets.map((preset) => [preset.id, preset]));

export const backgroundIds = backgroundPresets.map((preset) => preset.id);

export function getBackground(id: string): BackgroundPreset {
  return byId.get(id) || byId.get("aurora")!;
}

export function isBackgroundId(id: string) {
  return byId.has(id);
}

/** ה-CSS לשימוש ב-style. */
export function backgroundCss(id: string) {
  return getBackground(id).css;
}

/** חיפוש חופשי בשם, בקטגוריה ובמילות המפתח. */
export function searchBackgrounds(query: string, category?: BackgroundCategory | "all") {
  const term = query.trim().toLowerCase();
  return backgroundPresets.filter((preset) => {
    if (category && category !== "all" && preset.category !== category) return false;
    if (!term) return true;
    const haystack = [preset.name, preset.id, categoryLabel(preset.category), ...(preset.keywords || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });
}

export function categoryLabel(category: BackgroundCategory) {
  return backgroundCategories.find((entry) => entry.id === category)?.label || category;
}

export function countByCategory(category: BackgroundCategory) {
  return backgroundPresets.filter((preset) => preset.category === category).length;
}
