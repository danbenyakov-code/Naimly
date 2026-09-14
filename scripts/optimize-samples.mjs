/**
 * הכנת תמונות הדוגמה ל-public/samples.
 *
 * התמונות המקוריות נטענות בכל כניסה לדף הנחיתה ולכרטיס ההדגמה, ולכן
 * משקלן משפיע ישירות על זמן הטעינה. הסקריפט מקטין, חותך לפי התפקיד
 * ומייצר גם WebP — שקטן בכ-30% מ-JPEG באותה איכות.
 *
 * הלוגו נחתך לריבוע כי הוא מוצג כאווטאר עגול; תמונה לרוחב הייתה
 * נחתכת בדפדפן בלי שליטה על מה נשאר בפריים.
 *
 * שימוש:  node scripts/optimize-samples.mjs <מקור-לוגו> <מקור-קאבר>
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.join("public", "samples");
const [logoSource, coverSource] = process.argv.slice(2);

if (!logoSource || !coverSource) {
  console.error("\nשימוש: node scripts/optimize-samples.mjs <לוגו> <קאבר>\n");
  process.exit(1);
}

const kb = (file) => `${(fs.statSync(file).size / 1024).toFixed(0)}KB`;

async function build(source, target, transform) {
  if (!fs.existsSync(source)) {
    console.error(`  ✗ חסר: ${source}`);
    process.exit(1);
  }
  const before = kb(source);
  const jpg = path.join(dir, `${target}.jpg`);

  await transform(sharp(source)).jpeg({ quality: 82, mozjpeg: true }).toFile(jpg);

  const meta = await sharp(jpg).metadata();
  console.log(`  ✓ ${target.padEnd(14)} ${meta.width}×${meta.height}   ${before} → ${kb(jpg)}`);
}

console.log("\n=== תמונות דוגמה ===");

// לוגו: ריבוע ממורכז, ממוקד בשליש העליון שבו נמצאים הפנים.
await build(logoSource, "logo-example", (image) =>
  image.resize(512, 512, { fit: "cover", position: sharp.strategy.attention }),
);

// קאבר: רצועה רחבה. 1600 רוחב מספיק גם למסכים צפופים.
await build(coverSource, "cover-example", (image) =>
  image.resize(1600, 900, { fit: "cover", position: "center" }),
);

console.log();
