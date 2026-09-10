/**
 * מאחד את כל המיגרציות לקובץ אחד להדבקה ב-SQL Editor של Supabase.
 * שימושי כשאין גישת CLI לפרויקט (login/DB password).
 */
import fs from "node:fs";
import path from "node:path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

const header = [
  "-- " + "=".repeat(66),
  "-- NAIMLY — כל המיגרציות בקובץ אחד, לפי הסדר",
  "-- נוצר אוטומטית: npm run db:bundle",
  "-- להדבקה ב-Supabase → SQL Editor → Run",
  "-- " + "=".repeat(66),
  "",
].join("\n");

let out = header;
for (const name of files) {
  out += "\n-- " + "-".repeat(64) + "\n-- " + name + "\n-- " + "-".repeat(64) + "\n\n";
  out += fs.readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n").trim() + "\n";
}

fs.mkdirSync("supabase/bundle", { recursive: true });
fs.writeFileSync("supabase/bundle/all-migrations.sql", out);
console.log(`נוצר supabase/bundle/all-migrations.sql — ${(out.length / 1024).toFixed(1)}KB, ${files.length} מיגרציות`);
files.forEach((name, index) => console.log(`  ${index + 1}. ${name}`));
