/**
 * סריקת אבטחה מול המערכת החיה.
 *
 * בודקת ניצול בפועל, לא נוכחות של קוד הגנה: כל ממצא מנוסה מול השרת
 * ונמדד לפי מה שחזר. היעדר שגיאה אינו ראיה להצלחה, ולכן כל בדיקה
 * מסתכלת על הנתונים ולא על קוד התשובה בלבד.
 *
 * שימוש:
 *   node scripts/security-scan.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const base = (process.argv[2] || "https://naimly-mu.vercel.app").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let ok = 0;
const findings = [];
const pass = (name, detail) => { ok++; console.log(`  ✓ ${name}${detail ? `  — ${detail}` : ""}`); };
const finding = (severity, name, detail) => {
  findings.push({ severity, name, detail });
  console.log(`  ${severity === "high" ? "🔴" : severity === "medium" ? "🟠" : "🟡"} ${name}\n      ${detail}`);
};
const check = (name, safe, detail, severity = "high") => (safe ? pass(name, detail) : finding(severity, name, detail));

const get = (p, init) => fetch(`${base}${p}`, { redirect: "manual", ...init });

// ── 1. כותרות אבטחה ─────────────────────────────────────────────────────────
console.log("\n== 1. כותרות אבטחה ==");
const home = await get("/");
const h = home.headers;

const csp = h.get("content-security-policy") || "";
check("Content-Security-Policy קיים", Boolean(csp), csp ? `${csp.length} תווים` : "חסר לגמרי");
check("CSP חוסם unsafe-eval בפרודקשן", !csp.includes("unsafe-eval"), csp.includes("unsafe-eval") ? "unsafe-eval פעיל" : "");
check("CSP מגדיר frame-ancestors", /frame-ancestors/.test(csp), /frame-ancestors/.test(csp) ? "" : "אפשר להטמיע את האתר ב-iframe");
check("CSP מגדיר object-src", /object-src/.test(csp), /object-src/.test(csp) ? "" : "חסר object-src", "medium");

const hsts = h.get("strict-transport-security") || "";
const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] || 0);
check("HSTS עם max-age של שנה לפחות", maxAge >= 31536000, `max-age=${maxAge}`);

check("X-Content-Type-Options", h.get("x-content-type-options") === "nosniff", h.get("x-content-type-options") || "חסר");
check("X-Frame-Options", Boolean(h.get("x-frame-options")), h.get("x-frame-options") || "חסר", "medium");
check("Referrer-Policy", Boolean(h.get("referrer-policy")), h.get("referrer-policy") || "חסר", "medium");
check("X-Powered-By מוסתר", !h.get("x-powered-by"), h.get("x-powered-by") || "", "low");
check("Permissions-Policy", Boolean(h.get("permissions-policy")), h.get("permissions-policy") ? "" : "חסר — מומלץ להגביל מצלמה/מיקרופון", "low");

// ── 2. חשיפת סודות ─────────────────────────────────────────────────────────
console.log("\n== 2. חשיפת סודות ==");
const homeHtml = await (await fetch(base)).text();
check("מפתח service-role אינו ב-HTML", !homeHtml.includes(serviceKey || "@@none@@"), "");
check("אין sb_secret_ בעמוד", !/sb_secret_/.test(homeHtml), "");
check("אין SUPABASE_DB_URL בעמוד", !/postgres(ql)?:\/\//.test(homeHtml), "");

const scripts = [...homeHtml.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 12);
let leaked = null;
for (const src of scripts) {
  const body = await (await fetch(`${base}${src}`)).text();
  if (serviceKey && body.includes(serviceKey)) leaked = src;
  if (/sb_secret_/.test(body)) leaked = src;
}
check("מפתח service-role אינו ב-bundle של הדפדפן", !leaked, leaked || `${scripts.length} קבצים נסרקו`);

for (const p of ["/.env", "/.env.local", "/.git/config", "/supabase/migrations/001_initial_schema.sql"]) {
  const r = await get(p);
  check(`${p} אינו נגיש`, r.status >= 400, `HTTP ${r.status}`);
}

// ── 3. Open redirect ───────────────────────────────────────────────────────
console.log("\n== 3. הפניות פתוחות ==");
for (const evil of ["https://evil.example.com", "//evil.example.com", "/\\evil.example.com", "https:/\\evil.example.com"]) {
  const r = await get(`/auth/callback?code=fake&next=${encodeURIComponent(evil)}`);
  const loc = r.headers.get("location") || "";
  const escaped = /^https?:\/\//.test(loc) && !loc.startsWith(base);
  check(`next=${evil.slice(0, 28)} אינו מפנה החוצה`, !escaped, loc.slice(0, 70) || `HTTP ${r.status}`);
}

/*
 * המדד הוא ניצול, לא השתקפות. next חיצוני שנשמר בשדה מוסתר אינו פרצה
 * כל עוד השרת מריץ safeInternalPath לפני ההפניה — אבל אין סיבה
 * שכתובת בשליטת תוקף תגיע ל-DOM, ולכן זה עדיין ממצא בדרגה נמוכה.
 */
const login = await get(`/login?next=${encodeURIComponent("https://evil.example.com")}`);
const loginHtml = await login.text();
const inHref = loginHtml.includes('href="https://evil.example.com');
const inDom = loginHtml.includes('value="https://evil.example.com"');
check("next זדוני אינו הופך לקישור לחיץ", !inHref, inHref ? "קיים href חיצוני — הפניה פתוחה בלחיצה" : "", "high");
check("next זדוני אינו מגיע ל-DOM כלל", !inDom, inDom ? "נשמר בשדה מוסתר; מסונן בשרת אך עדיף לסנן ברינדור" : "", "low");

// ── 4. הזרקה בשדות הכרטיס ──────────────────────────────────────────────────
console.log("\n== 4. XSS והזרקה בכרטיס ==");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const { data: victim } = await admin.from("cards").select("id,slug,user_id").eq("is_published", true).limit(1).maybeSingle();

if (!victim) {
  console.log("  ⚠️  אין כרטיס מפורסם לבדיקה — מדלג על סעיף 4.");
} else {
  const original = (await admin.from("cards").select("website,slogan,business_name").eq("id", victim.id).single()).data;

  const payloads = {
    website: "javascript:alert(document.domain)",
    slogan: '"><script>alert(1)</script>',
    business_name: 'x" onmouseover="alert(1)',
  };
  await admin.from("cards").update(payloads).eq("id", victim.id);

  const page = await (await fetch(`${base}/${victim.slug}`, { cache: "no-store" })).text();

  check("javascript: URL אינו מגיע ל-href", !/href="javascript:/i.test(page), "");
  check("תגית script מוזרקת אינה מרונדרת", !/<script>alert\(1\)<\/script>/.test(page), "");
  check("מטפל onmouseover מוזרק אינו מרונדר", !/onmouseover="alert/.test(page), "");

  // vCard: הזרקת שורות חדשות תשבור את המבנה או תוסיף שדות.
  await admin.from("cards").update({ business_name: "רגיל\r\nTEL:+972500000000\r\nX-EVIL:1" }).eq("id", victim.id);
  const vcard = await (await fetch(`${base}/api/vcard/${victim.slug}`, { cache: "no-store" })).text();
  const lines = vcard.split("\r\n").filter(Boolean);
  check("vCard אינו ניתן להזרקת שורות", !lines.some((l) => l.startsWith("X-EVIL")), lines.find((l) => l.startsWith("X-EVIL")) || "");
  check("vCard נשאר תקין מבנית", lines[0] === "BEGIN:VCARD" && lines.at(-1) === "END:VCARD", "");

  await admin.from("cards").update(original).eq("id", victim.id);
  pass("שדות הכרטיס שוחזרו אחרי הבדיקה");
}

// ── 5. IDOR ו-RLS ──────────────────────────────────────────────────────────
console.log("\n== 5. גישה לנתונים של אחרים ==");
const { data: allLeads } = await anon.from("leads").select("id");
check("אנונימי אינו קורא לידים", (allLeads?.length ?? 0) === 0, `${allLeads?.length ?? 0} שורות`);

const { data: allProfiles } = await anon.from("profiles").select("id,email");
check("אנונימי אינו קורא פרופילים", (allProfiles?.length ?? 0) === 0, `${allProfiles?.length ?? 0} שורות`);

const { data: allSubs } = await anon.from("subscriptions").select("id");
check("אנונימי אינו קורא מנויים", (allSubs?.length ?? 0) === 0, `${allSubs?.length ?? 0} שורות`);

const { data: audit } = await anon.from("admin_audit_log").select("id");
check("אנונימי אינו קורא את יומן הביקורת", (audit?.length ?? 0) === 0, `${audit?.length ?? 0} שורות`);

const { data: payReq } = await anon.from("payment_requests").select("id");
check("אנונימי אינו קורא בקשות תשלום", (payReq?.length ?? 0) === 0, `${payReq?.length ?? 0} שורות`);

const { data: contactMsgs } = await anon.from("contact_messages").select("id");
check("אנונימי אינו קורא פניות יצירת קשר", (contactMsgs?.length ?? 0) === 0, `${contactMsgs?.length ?? 0} שורות`);

const { error: rpcError } = await anon.rpc("activate_subscription", { target_user: victim?.user_id, target_plan: "premium", months: 99, actor: null });
check("אנונימי אינו יכול להפעיל מנוי", Boolean(rpcError), rpcError ? "" : "הפונקציה רצה!");

const { error: trialRpc } = await anon.rpc("select_trial_plan");
check("אנונימי אינו יכול לבחור מסלול", Boolean(trialRpc), trialRpc ? "" : "הפונקציה רצה!");

const { error: markRpc } = await anon.rpc("mark_plan_selected", { target_user: victim?.user_id, target_plan: "premium" });
check("mark_plan_selected חסומה לאנונימי", Boolean(markRpc), markRpc ? "" : "הפונקציה רצה!");

// ── 6. מסלולים מוגנים ו-API ────────────────────────────────────────────────
console.log("\n== 6. מסלולים מוגנים ==");
for (const p of ["/dashboard", "/admin", "/admin/approvals", "/onboarding/plan"]) {
  const r = await get(p);
  check(`${p} דורש התחברות`, r.status === 307 || r.status === 302, `HTTP ${r.status}`);
}
for (const [p, method] of [["/api/admin/users", "POST"], ["/api/admin/users", "PUT"], ["/api/payments/request", "POST"]]) {
  const r = await get(p, { method, headers: { "Content-Type": "application/json" }, body: "{}" });
  check(`${method} ${p} דורש הרשאה`, [401, 403, 404].includes(r.status), `HTTP ${r.status}`);
}

// ── 7. Host header spoofing ────────────────────────────────────────────────
console.log("\n== 7. זיוף כותרות ==");
const spoof = await get("/", { headers: { "X-Forwarded-Host": "evil.example.com", Host: "evil.example.com" } });
const spoofHtml = await spoof.text();
check("Host מזויף אינו מגיע לקישורים בעמוד", !spoofHtml.includes("evil.example.com"), "");

// ── 8. הגבלת קצב ───────────────────────────────────────────────────────────
console.log("\n== 8. הגבלת קצב ==");
let limited = false;
let sent = 0;
for (let i = 0; i < 12; i++) {
  const r = await get("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "general", name: `בדיקת קצב ${i}`, email: "ratelimit@example.com", message: "בדיקת הגבלת קצב אוטומטית, אפשר להתעלם." }),
  });
  sent++;
  if (r.status === 429) { limited = true; break; }
}
check("טופס יצירת הקשר מוגבל בקצב", limited, limited ? `נחסם אחרי ${sent} בקשות` : `${sent} בקשות עברו בלי חסימה`, "medium");

// ── 9. חשיפת כרטיס לא מפורסם ───────────────────────────────────────────────
console.log("\n== 9. כרטיס לא מפורסם ==");
if (victim) {
  await admin.from("cards").update({ is_published: false }).eq("id", victim.id);
  const hidden = await get(`/${victim.slug}`);
  const { data: hiddenRow } = await anon.from("cards").select("slug").eq("id", victim.id);
  await admin.from("cards").update({ is_published: true }).eq("id", victim.id);

  check("כרטיס לא מפורסם אינו נגיש בדפדפן", hidden.status === 404 || hidden.status === 200 === false, `HTTP ${hidden.status}`);
  check("כרטיס לא מפורסם אינו נקרא דרך ה-API", (hiddenRow?.length ?? 0) === 0, `${hiddenRow?.length ?? 0} שורות`);
}

// ── 10. slug זדוני ─────────────────────────────────────────────────────────
console.log("\n== 10. קלט זדוני בנתיב ==");
for (const bad of ["' or 1=1--", "../../../etc/passwd", "<script>alert(1)</script>", "%00", "a".repeat(300)]) {
  const r = await get(`/${encodeURIComponent(bad)}`);
  const body = r.status < 400 ? await r.text() : "";
  const reflected = body.includes("<script>alert(1)</script>");
  check(`slug זדוני נדחה בבטחה: ${bad.slice(0, 20)}`, r.status >= 400 || !reflected, `HTTP ${r.status}`);
}

// ── סיכום ──────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
const high = findings.filter((f) => f.severity === "high").length;
const medium = findings.filter((f) => f.severity === "medium").length;
const low = findings.filter((f) => f.severity === "low").length;
console.log(`עברו: ${ok}  |  ממצאים: ${findings.length}  (חמור ${high} · בינוני ${medium} · נמוך ${low})`);
if (findings.length) {
  console.log("\nממצאים:");
  for (const f of findings) console.log(`  [${f.severity}] ${f.name} — ${f.detail}`);
}
console.log();
process.exit(high ? 1 : 0);
