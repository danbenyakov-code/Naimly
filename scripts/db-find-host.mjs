/**
 * מאתר את מארח ה-pooler של הפרויקט.
 *
 * פרויקטים חדשים ב-Supabase אינם חושפים את המארח הישיר
 * (db.<ref>.supabase.co), אלא רק pooler אזורי משותף. הסקריפט מנסה
 * להתחבר לכל אזור עד שאחד מאמת בהצלחה, וכותב את התוצאה ל-.env.local.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

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

const password = process.env.SUPABASE_DB_PASSWORD;
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!password || !ref) {
  console.log("\n❌ נדרשים SUPABASE_DB_PASSWORD ו-NEXT_PUBLIC_SUPABASE_URL ב-.env.local\n");
  process.exit(1);
}

// סדר הניסיון לפי סבירות: אירופה קודם, אחר כך ארה״ב.
const regions = [
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-central-2", "eu-west-3", "eu-north-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-southeast-1", "ap-southeast-2", "ap-south-1", "ap-northeast-1", "ap-northeast-2",
  "sa-east-1", "ca-central-1",
];

const candidates = [];
for (const prefix of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    // 5432 = session mode. מתאים למיגרציות (תומך בטרנזקציות ארוכות).
    candidates.push({ host: `${prefix}-${region}.pooler.supabase.com`, port: 5432, region });
  }
}

console.log(`\nמחפש את מארח ה-pooler של ${ref}...\n`);

let found = null;

for (const candidate of candidates) {
  const sql = postgres({
    host: candidate.host,
    port: candidate.port,
    database: "postgres",
    // ב-pooler שם המשתמש כולל את מזהה הפרויקט.
    username: `postgres.${ref}`,
    password,
    ssl: "require",
    max: 1,
    connect_timeout: 8,
    idle_timeout: 2,
    onnotice: () => {},
  });

  try {
    const [row] = await sql`select current_database() as db, version() as version`;
    console.log(`✅ נמצא: ${candidate.host}:${candidate.port}`);
    console.log(`   אזור:  ${candidate.region}`);
    console.log(`   מסד:   ${row.db}`);
    console.log(`   גרסה:  ${String(row.version).split(" ").slice(0, 2).join(" ")}`);
    found = candidate;
    await sql.end();
    break;
  } catch (error) {
    const message = String(error.message || "");
    // אימות שנכשל = המארח הנכון אך סיסמה שגויה. שווה לדווח מיד.
    if (message.includes("password authentication failed")) {
      console.log(`\n❌ ${candidate.host} — הסיסמה שגויה.`);
      console.log("   אפשר לאפס: Supabase → Settings → Database → Reset database password\n");
      await sql.end().catch(() => {});
      process.exit(1);
    }
    await sql.end().catch(() => {});
  }
}

if (!found) {
  console.log("❌ לא נמצא מארח מתאים.\n");
  console.log("אפשר למצוא את מחרוזת החיבור המדויקת ב-Supabase:");
  console.log("  Settings → Database → Connection string → URI\n");
  console.log("ואז להוסיף ל-.env.local:");
  console.log("  SUPABASE_DB_URL=<המחרוזת המלאה>\n");
  process.exit(1);
}

// שמירת המארח שנמצא, כדי שההרצות הבאות יהיו מיידיות.
const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${found.host}:${found.port}/postgres`;
let env = fs.readFileSync(".env.local", "utf8");
if (env.includes("SUPABASE_DB_URL=")) {
  env = env.replace(/SUPABASE_DB_URL=.*/, `SUPABASE_DB_URL=${url}`);
} else {
  env += `\n# מחרוזת החיבור שנמצאה אוטומטית (pooler, session mode).\nSUPABASE_DB_URL=${url}\n`;
}
fs.writeFileSync(".env.local", env);

console.log("\n✓ נשמר ב-.env.local כ-SUPABASE_DB_URL");
console.log("  אפשר להריץ עכשיו:  npm run db:migrate\n");
