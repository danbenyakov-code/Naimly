/**
 * מדידת Lighthouse לכרטיס הציבורי (BENCH-009).
 *
 * עד כה לא נמדד דבר: תנאי הקבלה דורש ביצועים 90+ ונגישות 95+, ואי אפשר
 * לטעון שעמדנו בהם בלי למדוד. הסקריפט מריץ מדידת מובייל על כרטיסי
 * התצוגה ונכשל אם הציון יורד מהסף.
 *
 * דורש Chrome מותקן במערכת. כשאין — הסקריפט מדווח ויוצא בקוד 0, כדי
 * שלא יחסום סביבה שאין בה דפדפן.
 *
 * שימוש:
 *   node scripts/lighthouse-audit.mjs                  # מול שרת מקומי
 *   node scripts/lighthouse-audit.mjs --base=https://…
 */
import { spawn } from "node:child_process";
import net from "node:net";

const SCORE_TARGETS = {
  performance: 90,
  accessibility: 95,
  "best-practices": 90,
  seo: 90,
};

const ROUTES = ["/noa-design", "/naimly-studio", "/naimly-consult"];

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));

async function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(base, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base, { cache: "no-store" });
      if (response.ok || response.status === 404) return true;
    } catch {
      // השרת עדיין עולה.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

let lighthouse;
let chromeLauncher;
try {
  ({ default: lighthouse } = await import("lighthouse"));
  chromeLauncher = await import("chrome-launcher");
} catch (error) {
  console.log(`\n⚠️  Lighthouse אינו זמין בסביבה הזו: ${error.message}\n`);
  process.exit(0);
}

let chrome;
try {
  chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
} catch {
  console.log("\n⚠️  לא נמצא Chrome במערכת. המדידה דולגה.\n");
  process.exit(0);
}

let server = null;
let base = baseArg ? baseArg.slice(7) : "";

if (!base) {
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn("npx", ["next", "start", "-p", String(port)], { shell: true, stdio: "ignore" });
  if (!(await waitForServer(base))) {
    console.error("\n❌ השרת לא עלה בזמן.\n");
    server.kill();
    await chrome.kill();
    process.exit(1);
  }
}

/*
 * חימום. המסלול הראשון שנמדד משלם את עלות הרינדור הקר של Next, וקיבל
 * ציון נמוך מהאחרים בלי שום הבדל בקוד. מדידה שתלויה בסדר אינה מדידה.
 */
for (const route of ROUTES) {
  await fetch(base + route, { cache: "no-store" }).catch(() => null);
}

console.log(`\n=== Lighthouse · מובייל · ${base} ===\n`);

let failures = 0;

for (const route of ROUTES) {
  const result = await lighthouse(
    base + route,
    { port: chrome.port, output: "json", logLevel: "error" },
    // תצורת מובייל: זו הסביבה שבה הכרטיס נצרך בפועל.
    { extends: "lighthouse:default", settings: { formFactor: "mobile", screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2 } } },
  );

  const scores = result.lhr.categories;
  console.log(`  ${route}`);
  for (const [key, target] of Object.entries(SCORE_TARGETS)) {
    const score = Math.round((scores[key]?.score || 0) * 100);
    const pass = score >= target;
    if (!pass) failures += 1;
    console.log(`    ${pass ? "PASS" : "FAIL"}  ${scores[key]?.title || key}: ${score} (יעד ${target})`);
  }
  console.log("");
}

if (server) server.kill();

/*
 * ניקוי Chrome זורק EPERM בחלונות כשהתיקייה הזמנית עדיין נעולה. זו
 * תקלת ניקוי בלבד — המדידה כבר הסתיימה, ואין סיבה שהיא תפיל את הריצה
 * ותסתיר את התוצאות.
 */
try {
  await chrome.kill();
} catch {
  // התיקייה הזמנית תנוקה על ידי מערכת ההפעלה.
}

console.log("=".repeat(60));
console.log(failures === 0 ? "✅ כל הציונים עומדים ביעד.\n" : `❌ ${failures} ציונים מתחת ליעד.\n`);
process.exit(failures === 0 ? 0 : 1);
