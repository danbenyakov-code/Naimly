/**
 * דחיפת משתני הסביבה מ-.env.local אל פרויקט Vercel.
 *
 * למה בכלל: .env.local מסונן מ-Git ולכן לעולם לא מגיע לענן. בלי הדחיפה
 * הזו האפליקציה עולה בלי חיבור ל-Supabase ונכנסת ל"מצב הדגמה".
 *
 * שימוש:
 *   node scripts/vercel-env.mjs                    # מה ייכתב, בלי לכתוב
 *   node scripts/vercel-env.mjs --apply            # כתיבה בפועל
 *   node scripts/vercel-env.mjs --apply --site-url https://example.com
 *
 * דרוש VERCEL_TOKEN (https://vercel.com/account/tokens) ב-.env.local.
 * ערכי הסודות לעולם אינם נכתבים ללוג — רק שמות ואורכים.
 */
import fs from "node:fs";
import path from "node:path";

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

const apply = process.argv.includes("--apply");
const redeploy = process.argv.includes("--redeploy");
const siteIndex = process.argv.indexOf("--site-url");
const siteOverride = siteIndex > -1 ? process.argv[siteIndex + 1] : "";
const token = process.env.VERCEL_TOKEN;
const projectName = process.env.VERCEL_PROJECT || "naimly";

if (!token) {
  console.error(`
❌ חסר VERCEL_TOKEN.

  1. https://vercel.com/account/tokens → Create Token
     Scope: החשבון שבו נמצא הפרויקט. תוקף: מספיק 1 day.
  2. ב-.env.local (מסונן מ-Git):  VERCEL_TOKEN=...
  3. שוב:  npm run vercel:env
`);
  process.exit(1);
}

/*
 * אלה נדרשים רק לכלי פיתוח מקומיים (מיגרציות, יצירת טיפוסים, קונפיגורציית
 * Auth). לאפליקציה בענן אין בהם שימוש, והעלאתם רק מרחיבה את שטח החשיפה.
 */
const LOCAL_ONLY = new Set([
  "SUPABASE_DB_URL",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT",
]);

/** מה שהאפליקציה באמת קוראת בזמן ריצה. */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BILLING_WHATSAPP",
  "NEXT_PUBLIC_BIT_PHONE",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "ADMIN_NOTIFICATION_EMAIL",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
];

const api = async (method, url, body) => {
  const response = await fetch(`https://api.vercel.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`\n❌ ${method} ${url} → HTTP ${response.status}`);
    console.error(`   ${text.slice(0, 300)}`);
    if (response.status === 403) console.error("   לטוקן אין הרשאה לפרויקט. יש לבדוק את ה-Scope.");
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
};

console.log(`\n=== פרויקט ${projectName} ===`);
const project = await api("GET", `/v9/projects/${encodeURIComponent(projectName)}`);
console.log(`  id: ${project.id}`);

/** כתובת הפרודקשן — ממנה נגזר NEXT_PUBLIC_SITE_URL. */
let siteUrl = siteOverride;
if (!siteUrl) {
  const domains = await api("GET", `/v9/projects/${project.id}/domains?production=true`);
  const chosen = (domains.domains || []).find((d) => !d.redirect) || (domains.domains || [])[0];
  siteUrl = chosen ? `https://${chosen.name}` : "";
}
if (!siteUrl) {
  console.error("\n❌ לא זוהתה כתובת פרודקשן. יש להעביר --site-url https://…\n");
  process.exit(1);
}
console.log(`  כתובת פרודקשן: ${siteUrl}`);

const desired = {};
const missing = [];
for (const key of REQUIRED) {
  const value = key === "NEXT_PUBLIC_SITE_URL" ? siteUrl : process.env[key];
  if (!value) { missing.push(key); continue; }
  desired[key] = value;
}

if (missing.length) {
  console.error(`\n❌ חסרים ב-.env.local: ${missing.join(", ")}\n`);
  process.exit(1);
}

const existing = await api("GET", `/v10/projects/${project.id}/env?decrypt=false`);
const byKey = new Map((existing.envs || []).map((entry) => [entry.key, entry]));

console.log("\n=== מה ייכתב (production + preview) ===");
for (const [key, value] of Object.entries(desired)) {
  const had = byKey.get(key);
  const shown = key.startsWith("NEXT_PUBLIC_") ? value : `(${value.length} תווים)`;
  console.log(`  ${had ? "↻ עדכון" : "+ חדש  "}  ${key.padEnd(30)} ${shown}`);
}

const skipped = Object.keys(process.env).filter((key) => LOCAL_ONLY.has(key));
if (skipped.length) console.log(`\n  מדולגים במכוון (מקומי בלבד): ${skipped.join(", ")}`);

if (!apply) {
  console.log(`\n${Object.keys(desired).length} משתנים ממתינים. להחלה:  npm run vercel:env -- --apply\n`);
  process.exit(0);
}

console.log("\nכותב…");
for (const [key, value] of Object.entries(desired)) {
  await api("POST", `/v10/projects/${project.id}/env?upsert=true`, {
    key,
    value,
    type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
    target: ["production", "preview"],
  });
  process.stdout.write(".");
}
console.log();

// אימות: הערכים המוצפנים אינם נקראים חזרה, ולכן בודקים נוכחות ויעד.
const after = await api("GET", `/v10/projects/${project.id}/env?decrypt=false`);
const now = new Map((after.envs || []).map((entry) => [entry.key, entry]));
const failed = Object.keys(desired).filter((key) => {
  const entry = now.get(key);
  return !entry || !entry.target?.includes("production");
});

if (failed.length) {
  console.error(`\n❌ לא נקלטו: ${failed.join(", ")}`);
  process.exit(1);
}

console.log(`\n✅ ${Object.keys(desired).length} משתנים נכתבו ואומתו ליעד production.`);
console.log("   משתני סביבה אינם חלים על דפלוי קיים — נדרש Redeploy:");
console.log("     node scripts/vercel-env.mjs --redeploy\n");

/**
 * הפעלת דפלוי חדש לפרודקשן.
 *
 * נדרש כי משתני סביבה נצרבים בזמן ה-build: דפלוי שכבר קיים לא "יראה"
 * ערכים שנוספו אחריו.
 */
if (redeploy) {
  const repoId = project.link?.repoId;
  const branch = project.link?.productionBranch || "main";
  if (!repoId) {
    console.error("\n❌ הפרויקט אינו מקושר ל-Git — יש להפעיל Redeploy מהדשבורד.\n");
    process.exit(1);
  }

  console.log(`\n=== דפלוי חדש לפרודקשן מהענף ${branch} ===`);
  const deployment = await api("POST", "/v13/deployments?forceNew=1", {
    name: project.name,
    target: "production",
    gitSource: { type: "github", repoId, ref: branch },
  });

  console.log(`  נוצר: ${deployment.id}`);
  console.log(`  https://${deployment.url}`);
  console.log("  הבנייה רצה ברקע. מצב:");
  console.log(`    node scripts/vercel-env.mjs --status ${deployment.id}\n`);
}

if (process.argv.includes("--status")) {
  const id = process.argv[process.argv.indexOf("--status") + 1];
  const deployment = await api("GET", `/v13/deployments/${id}`);
  console.log(`\n  ${deployment.readyState}  ${deployment.url || ""}\n`);
  if (deployment.readyState === "ERROR") process.exit(1);
}
