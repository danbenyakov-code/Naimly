/**
 * יצירת טיפוסי TypeScript מהסכמה החיה ב-Supabase.
 *
 * מדוע לא `--linked` ולא `--db-url`:
 *   --linked  דורש `supabase login` (OAuth בדפדפן) + `supabase link`, כלומר
 *             צעד אינטראקטיבי וקובץ supabase/config.toml מקומי.
 *   --db-url  דורש Docker/Podman מותקן ורץ — ה-CLI מריץ מכולה כדי לקרוא סכמה.
 *
 * --project-id עובד מול ה-Management API: בלי דפדפן, בלי מכולה, בלי קישור.
 * כל מה שדרוש הוא SUPABASE_ACCESS_TOKEN ב-.env.local (מסונן מ-Git).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = process.env.SUPABASE_PROJECT_REF || url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref) {
  console.error("\n❌ לא זוהה מזהה הפרויקט. יש להגדיר NEXT_PUBLIC_SUPABASE_URL או SUPABASE_PROJECT_REF ב-.env.local.\n");
  process.exit(1);
}

if (!token) {
  console.error(`
❌ חסר SUPABASE_ACCESS_TOKEN.

  1. פותחים  https://supabase.com/dashboard/account/tokens
  2. "Generate new token", נותנים שם (למשל naimly-cli) ומעתיקים
  3. מוסיפים ל-.env.local (הקובץ מסונן מ-Git):

       SUPABASE_ACCESS_TOKEN=sbp_...

  4. מריצים שוב:  npm run db:types

  זהו — אין צורך ב-\`supabase login\` ולא ב-\`supabase link\`.
`);
  process.exit(1);
}

const target = path.join("src", "lib", "database.types.ts");
console.log(`\nמייצר טיפוסים מהפרויקט ${ref} …`);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "gen", "types", "typescript", "--project-id", ref],
  { encoding: "utf8", env: process.env },
);

if (result.status !== 0 || !result.stdout?.includes("export type Database")) {
  console.error("\n❌ יצירת הטיפוסים נכשלה.");
  if (result.stderr) console.error(result.stderr.trim());
  if (result.stdout && !result.stdout.includes("export type Database")) console.error(result.stdout.trim());
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, result.stdout, "utf8");
console.log(`✅ נכתב ${target} (${(result.stdout.length / 1024).toFixed(1)}KB)\n`);
