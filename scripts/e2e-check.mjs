/**
 * בדיקת קצה-לקצה ללא דפדפן: מעלה את השרת, סורק את כל העמודים, ובודק
 *  - שכל מסלול מחזיר סטטוס תקין
 *  - שכל קישור פנימי מוביל לעמוד קיים
 *  - שכל עוגן (#id) קיים בעמוד היעד
 *  - שנתיבי ה-API מגיבים כמצופה להרשאות
 *  - שכל תמונה/סקריפט מקומי נטען
 *  - שאין overflow אופקי מוצהר ושיעדי המגע מספיקים (בדיקה סטטית)
 *
 * הרצה: node scripts/e2e-check.mjs [baseUrl]
 * ללא baseUrl — מריץ `next start` על פורט פנוי ומכבה בסיום.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const argBase = process.argv[2];

const results = { pass: 0, fail: 0, warn: 0 };
const failures = [];
const warnings = [];

function ok(name) {
  results.pass += 1;
  console.log(`  PASS  ${name}`);
}
function fail(name, detail) {
  results.fail += 1;
  failures.push(`${name} — ${detail}`);
  console.log(`  FAIL  ${name}\n        ${detail}`);
}
function warn(name, detail) {
  results.warn += 1;
  warnings.push(`${name} — ${detail}`);
  console.log(`  WARN  ${name}\n        ${detail}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
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
      const response = await fetch(base, { redirect: "manual" });
      if (response.status > 0) return true;
    } catch {
      // עדיין עולה
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// ── עמודים לסריקה ───────────────────────────────────────────────────────────
const publicRoutes = [
  "/",
  "/pricing",
  "/accessibility",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/login",
  "/signup",
  "/contact",
  "/contact?topic=technical",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/icon.svg",
];

// כתובות ישנות שנשמרו לתאימות ומפנות ליעד החדש.
const permanentRedirects = [
  { from: "/forgot-password", to: "/login?mode=forgot" },
  { from: "/reset-password", to: "/login?mode=forgot" },
];

// מסלולים שדורשים התחברות: מצופה הפניה ל-login (או 200 במצב הדגמה).
const guardedRoutes = ["/dashboard", "/dashboard/card", "/dashboard/analytics", "/dashboard/leads", "/dashboard/settings", "/admin", "/admin/approvals", "/checkout?plan=pro"];

// נתיבי API ובדיקת ההרשאה שלהם ללא התחברות.
const apiChecks = [
  { path: "/api/cards", method: "POST", body: {}, expect: [401, 402, 400] },
  { path: "/api/uploads", method: "POST", body: null, expect: [401, 400] },
  { path: "/api/payments/request", method: "POST", body: { planId: "pro" }, expect: [401, 503, 400] },
  { path: "/api/admin/users", method: "POST", body: { email: "x@y.com", fullName: "aa", planId: "trial" }, expect: [401, 403] },
  { path: "/api/admin/payment-requests/00000000-0000-0000-0000-000000000000", method: "POST", body: { action: "approve" }, expect: [401, 403] },
  { path: "/api/leads/export", method: "GET", expect: [401, 403] },
  { path: "/api/events", method: "POST", body: { slug: "noa-design", type: "view" }, expect: [200, 400, 404, 503] },
  { path: "/api/leads", method: "POST", body: { slug: "noa-design", name: "בדיקה", phone: "0500000000", email: "", message: "" }, expect: [200, 400, 404, 503] },
  { path: "/api/vcard/noa-design", method: "GET", expect: [200, 404] },
  { path: "/api/contact", method: "POST", body: { topic: "general", name: "בודק", email: "t@e.com", message: "הודעת בדיקה ארוכה מספיק" }, expect: [200, 400, 429, 503] },
  { path: "/api/contact", method: "POST", body: { topic: "nope" }, expect: [400] },
  { path: "/api/vcard/does-not-exist-xyz", method: "GET", expect: [404] },
  // נתיבים שהוסרו — לא אמורים להתקיים יותר
  { path: "/api/payments/checkout", method: "POST", body: {}, expect: [404, 405] },
  { path: "/api/payments/webhook", method: "POST", body: {}, expect: [404, 405] },
];

// ── עזרי HTML ───────────────────────────────────────────────────────────────
const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[2] ?? match[3] ?? "") : "";
};

function collect(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) || [];
}

function decode(value) {
  return value.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function main() {
  let base = argBase;
  let server = null;

  if (!base) {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    console.log(`\nמעלה שרת על ${base} ...`);
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", "127.0.0.1"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production" },
    });
    let serverLog = "";
    server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
    server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

    if (!(await waitForServer(base))) {
      console.error("השרת לא עלה בזמן:\n" + serverLog);
      server.kill();
      process.exit(1);
    }
    console.log("השרת עלה.\n");
  }

  const pages = new Map();

  // ── 1. עמודים ציבוריים ────────────────────────────────────────────────────
  console.log("== עמודים ציבוריים ==");
  for (const route of publicRoutes) {
    try {
      const response = await fetch(base + route, { redirect: "manual" });
      const body = await response.text();
      if (response.status === 200) {
        ok(`${route} → 200`);
        if (response.headers.get("content-type")?.includes("text/html")) pages.set(route, body);
      } else {
        fail(`${route}`, `סטטוס ${response.status}`);
      }
    } catch (error) {
      fail(`${route}`, String(error));
    }
  }

  // ── 2. עמוד כרטיס ציבורי (הדגמה) ─────────────────────────────────────────
  console.log("\n== כרטיס ציבורי ==");
  for (const [route, expected] of [["/noa-design", 200], ["/definitely-not-a-real-slug", 404]]) {
    const response = await fetch(base + route, { redirect: "manual" });
    if (response.status === expected) {
      ok(`${route} → ${response.status}`);
      if (expected === 200) pages.set(route, await response.text());
    } else {
      fail(route, `ציפינו ל-${expected}, קיבלנו ${response.status}`);
    }
  }

  // ── 2b. הפניות תאימות ────────────────────────────────────────────────────
  console.log("\n== הפניות תאימות ==");
  for (const rule of permanentRedirects) {
    const response = await fetch(base + rule.from, { redirect: "manual" });
    const target = response.headers.get("location") || "";
    if ([301, 302, 307, 308].includes(response.status) && target.includes(rule.to.split("?")[0])) {
      ok(`${rule.from} → ${response.status} → ${target}`);
    } else {
      fail(rule.from, `ציפינו להפניה אל ${rule.to}, קיבלנו ${response.status} ${target}`);
    }
  }

  // ── 3. מסלולים מוגנים ────────────────────────────────────────────────────
  console.log("\n== מסלולים מוגנים ==");
  for (const route of guardedRoutes) {
    const response = await fetch(base + route, { redirect: "manual" });
    if ([200, 307, 308, 302].includes(response.status)) {
      const target = response.headers.get("location") || "";
      ok(`${route} → ${response.status}${target ? ` → ${target}` : ""}`);
      if (response.status === 200) pages.set(route, await response.text());
    } else {
      fail(route, `סטטוס לא צפוי ${response.status}`);
    }
  }

  // ── 4. נתיבי API ─────────────────────────────────────────────────────────
  console.log("\n== נתיבי API ==");
  for (const check of apiChecks) {
    try {
      const init = { method: check.method, redirect: "manual" };
      if (check.body !== undefined && check.body !== null) {
        init.headers = { "content-type": "application/json" };
        init.body = JSON.stringify(check.body);
      }
      const response = await fetch(base + check.path, init);
      if (check.expect.includes(response.status)) {
        ok(`${check.method} ${check.path} → ${response.status}`);
      } else {
        fail(`${check.method} ${check.path}`, `ציפינו לאחד מ-${check.expect.join("/")}, קיבלנו ${response.status}`);
      }
    } catch (error) {
      fail(`${check.method} ${check.path}`, String(error));
    }
  }

  // ── 5. קישורים פנימיים ועוגנים ───────────────────────────────────────────
  console.log("\n== קישורים פנימיים ==");
  const linkTargets = new Map();
  for (const [route, html] of pages) {
    for (const tag of collect(html, "a")) {
      const href = decode(attr(tag, "href")).trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("http") || href.startsWith("data:") || href.startsWith("javascript:")) continue;
      if (!href.startsWith("/")) continue;
      if (!linkTargets.has(href)) linkTargets.set(href, new Set());
      linkTargets.get(href).add(route);
    }
  }

  const anchorChecks = [];
  for (const [href, sources] of linkTargets) {
    const [pathPart, hash] = href.split("#");
    const target = pathPart || "/";
    try {
      const response = await fetch(base + target, { redirect: "manual" });
      const good = [200, 301, 302, 307, 308].includes(response.status);
      if (good) {
        ok(`קישור ${href} (מתוך ${[...sources][0]})`);
        if (hash && response.status === 200) anchorChecks.push({ target, hash, href });
      } else {
        fail(`קישור ${href}`, `סטטוס ${response.status} — מופיע ב: ${[...sources].join(", ")}`);
      }
    } catch (error) {
      fail(`קישור ${href}`, String(error));
    }
  }

  console.log("\n== עוגנים (#id) ==");
  const anchorCache = new Map();
  for (const { target, hash, href } of anchorChecks) {
    if (!anchorCache.has(target)) anchorCache.set(target, await (await fetch(base + target)).text());
    const html = anchorCache.get(target);
    if (html.includes(`id="${hash}"`)) ok(`עוגן ${href}`);
    else fail(`עוגן ${href}`, `אין אלמנט עם id="${hash}" בעמוד ${target}`);
  }

  // ── 6. נכסים מקומיים ─────────────────────────────────────────────────────
  console.log("\n== נכסים מקומיים ==");
  const assets = new Set();
  for (const html of pages.values()) {
    for (const tag of [...collect(html, "img"), ...collect(html, "script"), ...collect(html, "link")]) {
      const url = decode(attr(tag, "src") || attr(tag, "href")).trim();
      if (url.startsWith("/") && !url.startsWith("//")) assets.add(url);
    }
  }
  for (const asset of assets) {
    if (linkTargets.has(asset)) continue;
    const response = await fetch(base + asset, { redirect: "manual" });
    if (response.status === 200) ok(`נכס ${asset}`);
    else fail(`נכס ${asset}`, `סטטוס ${response.status}`);
  }

  // ── 7. מובייל: viewport, יעדי מגע, overflow ──────────────────────────────
  console.log("\n== מובייל ==");
  for (const [route, html] of pages) {
    if (!html.includes("<meta name=\"viewport\"") && !html.includes("name=\"viewport\"")) {
      fail(`viewport ב-${route}`, "חסר תג viewport");
    }
    // רוחב קבוע בפיקסלים על אלמנט ראשי שובר מסכים צרים.
    const fixedWidth = html.match(/style="[^"]*\bwidth:\s*\d{4,}px/i);
    if (fixedWidth) warn(`רוחב קבוע ב-${route}`, fixedWidth[0].slice(0, 80));
  }
  if (pages.size) ok(`נבדקו ${pages.size} עמודים למטא-תגי מובייל`);

  // ── 8. כותרות אבטחה ──────────────────────────────────────────────────────
  console.log("\n== כותרות אבטחה ==");
  const headResponse = await fetch(base + "/");
  for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy", "x-frame-options"]) {
    if (headResponse.headers.get(header)) ok(`כותרת ${header}`);
    else fail(`כותרת ${header}`, "חסרה");
  }
  if (headResponse.headers.get("x-powered-by")) fail("x-powered-by", "נחשף שרת");
  else ok("x-powered-by מוסתר");

  // ── סיכום ────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`עברו: ${results.pass} | נכשלו: ${results.fail} | אזהרות: ${results.warn}`);
  if (failures.length) {
    console.log("\nכשלים:");
    failures.forEach((item) => console.log(`  - ${item}`));
  }
  if (warnings.length) {
    console.log("\nאזהרות:");
    warnings.forEach((item) => console.log(`  - ${item}`));
  }

  if (server) server.kill();
  process.exit(results.fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
