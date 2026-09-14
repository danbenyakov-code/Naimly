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

/** שם תצוגה בעברית מתוך שם הקובץ. */
/**
 * שם וקטגוריה נגזרים מהתמונה, לא משם הקובץ.
 *
 * קבצים שמגיעים בשמות כמו "12.jpg" היו הופכים לרקע בשם "12" — חסר
 * משמעות לבעל עסק שמנסה לבחור. גוון, רוויה ובהירות נמדדים ומתורגמים
 * לשם בעברית שאפשר לחפש לפיו.
 */
const HUE_NAMES = [
  [15, "אדום"], [45, "כתום"], [70, "זהב"], [160, "ירוק"],
  [200, "טורקיז"], [255, "כחול"], [290, "סגול"], [335, "ורוד"], [360, "אדום"],
];

function describe(stats) {
  const [r, g, b] = stats.channels.map((channel) => channel.mean / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  // רוויה נמוכה = גוון אפור. שם צבע כאן היה מטעה.
  if (saturation < 0.12) {
    const tone = lightness < 0.15 ? "שחור" : lightness < 0.35 ? "אפור כהה"
      : lightness < 0.6 ? "אפור" : lightness < 0.85 ? "אפור בהיר" : "לבן";
    return { name: tone, category: lightness < 0.4 ? "dark" : lightness > 0.8 ? "minimal" : "professional" };
  }

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  const color = (HUE_NAMES.find(([limit]) => hue <= limit) || [0, "צבעוני"])[1];
  const tone = lightness < 0.3 ? "כהה" : lightness > 0.7 ? "בהיר" : "";

  return {
    name: tone ? `${color} ${tone}` : color,
    category: color === "זהב" ? "luxury" : lightness < 0.35 ? "dark" : "colorful",
  };
}

console.log(`\n=== ${files.length} רקעים ב-${SOURCE} ===\n`);

const entries = [];
const nameCounts = new Map();

for (const file of files) {
  const full = path.join(SOURCE, file);
  const base = file.replace(/\.[^.]+$/, "");
  const id = `img-${base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;

  const original = fs.readFileSync(full);
  const image = sharp(original);
  const meta = await image.metadata();

  // בהירות ממוצעת: ממוצע שלושת הערוצים על תמונה מוקטנת.
  const stats = await sharp(original).resize(64, 64, { fit: "inside" }).stats();
  const luminance = (stats.channels[0].mean * 0.2126 + (stats.channels[1]?.mean ?? 0) * 0.7152 + (stats.channels[2]?.mean ?? 0) * 0.0722) / 255;
  const foreground = luminance < 0.5 ? "light" : "dark";
  const fallback = luminance < 0.5 ? "#111827" : "#f4f6fa";
  const described = describe(stats);
  const seen = nameCounts.get(described.name) || 0;
  nameCounts.set(described.name, seen + 1);
  const name = seen === 0 ? described.name : `${described.name} ${seen + 1}`;

  const target = path.join(SOURCE, `${base}.jpg`);
  const before = (original.length / 1024).toFixed(0);

  if (apply) {
    /*
     * כתיבה דרך קובץ זמני, ולא מחיקה-ואז-כתיבה.
     *
     * sharp מחזיק את הקובץ פתוח בזמן העיבוד, ולכן unlink על המקור נכשל
     * ב-EBUSY בחלונות. בנוסף, מערכת קבצים חסרת רגישות לאותיות רואה
     * ב-1.JPG ו-1.jpg אותו קובץ — מחיקה אחרי כתיבה הייתה מוחקת את התוצאה.
     */
    const buffer = await sharp(original)
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, buffer);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    fs.renameSync(temporary, target);
  }

  const after = apply ? (fs.statSync(target).size / 1024).toFixed(0) : "—";
  console.log(`  ${name.padEnd(16)} ${described.category.padEnd(13)} ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(5)} ${foreground.padEnd(6)} ${before}KB → ${after}KB`);

  entries.push({ id, name, category: described.category, foreground, fallback, file: `${base}.jpg` });
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
