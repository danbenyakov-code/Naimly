/**
 * מריץ את המיגרציות ישירות מול Postgres של Supabase.
 *
 * דורש בסביבה (ב-.env.local, שאינו נכנס ל-Git):
 *   SUPABASE_DB_URL=postgresql://postgres:<סיסמה>@db.<ref>.supabase.co:5432/postgres
 * או:
 *   SUPABASE_DB_PASSWORD=<סיסמה>            (עם NEXT_PUBLIC_SUPABASE_URL לגזירת המארח)
 *
 * כל מיגרציה רצה בתוך טרנזקציה: או שהיא עוברת כולה, או שכלום לא משתנה.
 * ההרצות נרשמות בטבלת schema_migrations, כך שהרצה חוזרת מדלגת על מה שכבר בוצע.
 *
 * שימוש:
 *   node scripts/db-migrate.mjs          # מריץ את מה שחסר
 *   node scripts/db-migrate.mjs --status # מה בוצע ומה ממתין
 *   node scripts/db-migrate.mjs --dry    # מה היה רץ, בלי לבצע
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

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry");
const statusOnly = flags.has("--status");

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return "";

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) return "";

  // הסיסמה מקודדת — היא עשויה להכיל תווים מיוחדים.
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

const url = connectionString();

if (!url) {
  console.log("\n❌ חסרים פרטי חיבור למסד הנתונים.\n");
  console.log("יש להוסיף ל-.env.local אחת מהאפשרויות:\n");
  console.log("  SUPABASE_DB_PASSWORD=<הסיסמה של מסד הנתונים>");
  console.log("     (Supabase → Settings → Database → Database password)\n");
  console.log("  או, לחלופין, מחרוזת חיבור מלאה:");
  console.log("  SUPABASE_DB_URL=postgresql://postgres:<סיסמה>@db.<ref>.supabase.co:5432/postgres\n");
  console.log("הקובץ .env.local מסונן מ-Git ולא נדחף לעולם.\n");
  process.exit(1);
}

const safeUrl = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
console.log(`\nמתחבר אל ${safeUrl}\n`);

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
  onnotice: () => {},
});

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

try {
  // טבלת מעקב. נוצרת מחוץ לטרנזקציות של המיגרציות עצמן.
  await sql`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now(),
      checksum text not null default ''
    )
  `;

  const applied = await sql`select name, applied_at from public.schema_migrations order by name`;
  const appliedNames = new Set(applied.map((row) => row.name));

  console.log("=== מצב המיגרציות ===");
  for (const name of files) {
    const done = appliedNames.has(name);
    const when = done ? applied.find((row) => row.name === name)?.applied_at?.toISOString().slice(0, 16).replace("T", " ") : "";
    console.log(`  ${done ? "✓" : "·"} ${name}${when ? `  (${when})` : ""}`);
  }

  const pending = files.filter((name) => !appliedNames.has(name));

  if (statusOnly) {
    console.log(`\n${pending.length ? `${pending.length} מיגרציות ממתינות.` : "הכול עדכני."}\n`);
    await sql.end();
    process.exit(0);
  }

  if (!pending.length) {
    console.log("\n✅ הכול עדכני — אין מה להריץ.\n");
    await sql.end();
    process.exit(0);
  }

  console.log(`\n=== הרצה: ${pending.length} מיגרציות ===\n`);

  for (const name of pending) {
    const content = fs.readFileSync(path.join(dir, name), "utf8");

    if (dryRun) {
      console.log(`  [dry] ${name} — ${(content.length / 1024).toFixed(1)}KB`);
      continue;
    }

    process.stdout.write(`  ${name} ... `);
    const started = Date.now();
    try {
      // טרנזקציה אחת לכל מיגרציה: הכול או כלום.
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`insert into public.schema_migrations (name) values (${name})`;
      });
      console.log(`✓ (${Date.now() - started}ms)`);
    } catch (error) {
      console.log("✗");
      console.error(`\n❌ ${name} נכשלה. שום שינוי מהקובץ הזה לא הוחל.\n`);
      console.error(`   ${error.message}`);
      if (error.position) console.error(`   מיקום בקובץ: תו ${error.position}`);
      if (error.detail) console.error(`   פירוט: ${error.detail}`);
      if (error.hint) console.error(`   רמז: ${error.hint}`);
      await sql.end();
      process.exit(1);
    }
  }

  if (!dryRun) console.log("\n✅ כל המיגרציות הורצו בהצלחה.\n");
  await sql.end();
  process.exit(0);
} catch (error) {
  console.error(`\n❌ החיבור נכשל: ${error.message}`);
  if (String(error.message).includes("password authentication")) {
    console.error("   הסיסמה שגויה. אפשר לאפס אותה ב-Supabase → Settings → Database.");
  }
  if (String(error.code) === "ENOTFOUND") {
    console.error("   המארח לא נמצא. יש לוודא את כתובת הפרויקט.");
  }
  await sql.end().catch(() => {});
  process.exit(1);
}
