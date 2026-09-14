/**
 * בניית רישום רקעי התמונה מתוך public/backgrounds.
 *
 * במקום למפות עשרות קבצים ביד — מה שנשבר בכל הוספה — הסקריפט סורק את
 * התיקייה, מדחס כל תמונה, מזהה את הבהירות הממוצעת שלה וכותב קובץ
 * רישום מיוצר. הוספת רקע = להעתיק קובץ ולהריץ שוב.
 *
 * הבהירות נמדדת ולא נקבעת ידנית: היא קובעת אם הטקסט מעל הרקע יהיה
 * כהה או בהיר, ואומדן שגוי פירושו כרטיס שאי אפשר לקרוא.
 *
 * שימוש:
 *   node scripts/build-background-registry.mjs            # מה יקרה
 *   node scripts/build-background-registry.mjs --apply    # כתיבה בפועל
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.join("public", "backgrounds");
const OUTPUT = path.join("src", "lib", "background-images.generated.ts");
const apply = process.argv.includes("--apply");

if (!fs.existsSync(SOURCE)) {
  console.error(`\n❌ התיקייה ${SOURCE} אינה קיימת.\n`);
  process.exit(1);
}

const files = fs
  .readdirSync(SOURCE)
  .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  .sort();

if (!files.length) {
  console.log(`\nאין תמונות ב-${SOURCE}. יש להעתיק קבצים ולהריץ שוב.\n`);
  process.exit(0);
}

/** קטגוריה נגזרת מקידומת בשם הקובץ, אם קיימת. */
const CATEGORIES = ["professional", "minimal", "luxury", "colorful", "dark", "light", "tech", "creative", "gradient", "geometric"];

/** שם תצוגה בעברית מתוך שם הקובץ. */
const HEBREW_HINTS = {
  marble: "שיש", dark: "כהה", white: "לבן", black: "שחור", gold: "זהב",
  geometric: "גאומטרי", gradient: "מעבר", texture: "מרקם", wood: "עץ",
  fire: "אש", smoke: "עשן", concrete: "בטון", paper: "נייר", metal: "מתכת",
  pink: "ורוד", blue: "כחול", red: "אדום", grey: "אפור", gray: "אפור",
  floral: "פרחוני", leaves: "עלים", deco: "ארט דקו", hex: "משושים",
  cube: "קוביות", line: "קווים", dot: "נקודות", star: "כוכבים",
  luxury: "יוקרה", minimal: "מינימלי", tech: "טכנולוגי",
};

function displayName(base) {
  const words = base.replace(/[-_]+/g, " ").trim().split(/\s+/);
  const hebrew = words.map((word) => HEBREW_HINTS[word.toLowerCase()]).filter(Boolean);
  return hebrew.length ? hebrew.join(" ") : base.replace(/[-_]+/g, " ");
}

function categoryOf(base) {
  const found = CATEGORIES.find((category) => base.toLowerCase().startsWith(`${category}-`));
  return found || "creative";
}

console.log(`\n=== ${files.length} רקעים ב-${SOURCE} ===\n`);

const entries = [];

for (const file of files) {
  const full = path.join(SOURCE, file);
  const base = file.replace(/\.[^.]+$/, "");
  const id = `img-${base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;

  const image = sharp(full);
  const meta = await image.metadata();

  // בהירות ממוצעת: ממוצע שלושת הערוצים על תמונה מוקטנת.
  const stats = await image.clone().resize(64, 64, { fit: "inside" }).stats();
  const luminance = (stats.channels[0].mean * 0.2126 + (stats.channels[1]?.mean ?? 0) * 0.7152 + (stats.channels[2]?.mean ?? 0) * 0.0722) / 255;
  const foreground = luminance < 0.5 ? "light" : "dark";
  const fallback = luminance < 0.5 ? "#111827" : "#f4f6fa";

  const target = path.join(SOURCE, `${base}.jpg`);
  const before = (fs.statSync(full).size / 1024).toFixed(0);

  if (apply) {
    const buffer = await sharp(full)
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    if (full !== target) fs.unlinkSync(full);
    fs.writeFileSync(target, buffer);
  }

  const after = apply ? (fs.statSync(target).size / 1024).toFixed(0) : "—";
  console.log(`  ${id.padEnd(34)} ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(5)} ${foreground.padEnd(6)} ${before}KB → ${after}KB`);

  entries.push({ id, name: displayName(base), category: categoryOf(base), foreground, fallback, file: `${base}.jpg` });
}

if (!apply) {
  console.log(`\n${entries.length} רקעים יעובדו וייכתבו ל-${OUTPUT}.`);
  console.log("להחלה:  node scripts/build-background-registry.mjs --apply\n");
  process.exit(0);
}

const source = [
  "// ⚠️ קובץ מיוצר. אין לערוך ידנית.",
  "// נוצר על ידי scripts/build-background-registry.mjs מתוך public/backgrounds.",
  "//",
  "// foreground ו-fallback נמדדים מהתמונה עצמה ולא נקבעים ידנית: אומדן",
  "// שגוי של בהירות פירושו טקסט שאי אפשר לקרוא מעל הרקע.",
  "",
  'import type { BackgroundPreset } from "@/lib/backgrounds";',
  "",
  "export const imageBackgrounds: BackgroundPreset[] = [",
  ...entries.map((entry) =>
    `  { id: ${JSON.stringify(entry.id)}, name: ${JSON.stringify(entry.name)}, category: ${JSON.stringify(entry.category)}, ` +
    `foreground: ${JSON.stringify(entry.foreground)}, image: ${JSON.stringify(`/backgrounds/${entry.file}`)}, css: ${JSON.stringify(entry.fallback)} },`,
  ),
  "];",
  "",
].join("\r\n");

fs.writeFileSync(OUTPUT, source);
console.log(`\n✅ ${entries.length} רקעים נכתבו ל-${OUTPUT}\n`);
