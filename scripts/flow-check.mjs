/**
 * בדיקת זרימות מקצה לקצה מול שרת חי.
 * לא בודקת רק שהעמוד נטען — אלא שהתהליך עצמו עובד: שליחת פנייה, פתיחת
 * בקשת תשלום, אכיפת הרשאות, מדיניות סיסמה ותקינות קישורי הוואטסאפ.
 *
 * הרצה: node scripts/flow-check.mjs [baseUrl]
 */
const base = process.argv[2] || "http://127.0.0.1:3100";

let pass = 0;
let failCount = 0;
const failures = [];

function ok(name, detail = "") {
  pass += 1;
  console.log(`  ✓ ${name}${detail ? `  ${detail}` : ""}`);
}
function fail(name, detail) {
  failCount += 1;
  failures.push(`${name} — ${detail}`);
  console.log(`  ✗ ${name}\n      ${detail}`);
}

async function post(path, body) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try { json = await response.json(); } catch { /* ייתכן שאין גוף JSON */ }
  return { status: response.status, json };
}

async function html(path) {
  const response = await fetch(base + path, { redirect: "manual" });
  return { status: response.status, body: await response.text(), location: response.headers.get("location") };
}

console.log(`\nבודק זרימות מול ${base}\n`);

// ── 1. טופס יצירת קשר ────────────────────────────────────────────────────────
console.log("== טופס יצירת קשר ==");
{
  const valid = await post("/api/contact", {
    topic: "technical",
    name: "בודק מערכת",
    email: "qa@naimly.test",
    phone: "0501234567",
    message: "בדיקת זרימה אוטומטית של טופס יצירת הקשר.",
  });
  if (valid.status === 200 && valid.json?.ok) ok("שליחת פנייה תקינה");
  else fail("שליחת פנייה תקינה", `סטטוס ${valid.status} ${JSON.stringify(valid.json)}`);

  const shortMessage = await post("/api/contact", { topic: "general", name: "אב", email: "a@b.com", message: "קצר" });
  if (shortMessage.status === 400 && shortMessage.json?.field === "message") ok("הודעה קצרה נדחית עם שם השדה");
  else fail("הודעה קצרה נדחית", `סטטוס ${shortMessage.status} ${JSON.stringify(shortMessage.json)}`);

  const badEmail = await post("/api/contact", { topic: "general", name: "אב", email: "not-an-email", message: "הודעה ארוכה מספיק לבדיקה" });
  if (badEmail.status === 400 && badEmail.json?.field === "email") ok("אימייל שגוי נדחה עם שם השדה");
  else fail("אימייל שגוי נדחה", `סטטוס ${badEmail.status} ${JSON.stringify(badEmail.json)}`);

  const badTopic = await post("/api/contact", { topic: "hacking", name: "אב", email: "a@b.com", message: "הודעה ארוכה מספיק לבדיקה" });
  if (badTopic.status === 400) ok("נושא לא מוכר נדחה");
  else fail("נושא לא מוכר נדחה", `סטטוס ${badTopic.status}`);

  const honeypot = await post("/api/contact", { topic: "general", name: "בוט", email: "bot@spam.com", message: "הודעה ארוכה מספיק לבדיקה", company: "spam" });
  if (honeypot.status === 200) ok("מלכודת הספאם בולעת בשקט");
  else fail("מלכודת ספאם", `סטטוס ${honeypot.status}`);
}

// ── 2. נושאי הפנייה מופיעים בטופס ────────────────────────────────────────────
console.log("\n== נושאי הפנייה ==");
{
  const page = await html("/contact");
  for (const topic of ["המלצות ייעול ושיפור", "מכירות", "הדרכה", "תקלה טכנית", "שאלה כללית"]) {
    if (page.body.includes(topic)) ok(`נושא "${topic}" מוצג`);
    else fail(`נושא "${topic}"`, "לא נמצא בעמוד");
  }
  const preselect = await html("/contact?topic=technical");
  if (preselect.status === 200) ok("בחירה מראש של נושא מה-URL");
  else fail("בחירה מראש", `סטטוס ${preselect.status}`);
}

// ── 3. התחברות מאוחדת ───────────────────────────────────────────────────────
console.log("\n== התחברות מאוחדת ==");
{
  const login = await html("/login");
  const checks = [
    ["לשונית כניסה", 'role="tab"'],
    ["שדה אימייל", 'type="email"'],
    ["שדה סיסמה", 'type="password"'],
    ["סימון שדה חובה", "required-field"],
    ["קישור לשחזור סיסמה", "שכחתי את הסיסמה"],
  ];
  for (const [label, needle] of checks) {
    if (login.body.includes(needle)) ok(label);
    else fail(label, `לא נמצא "${needle}"`);
  }

  // דרישה מפורשת: אין כניסה ללא סיסמה בשום מקום במסך.
  const forbidden = ["קוד חד־פעמי", "כניסה ללא סיסמה", "קישור חד־פעמי", "magic"];
  const offenders = forbidden.filter((needle) => login.body.includes(needle));
  if (offenders.length === 0) ok("אין כניסה ללא סיסמה במסך הכניסה");
  else fail("כניסה ללא סיסמה", `נמצאו אזכורים: ${offenders.join(", ")}`);

  const signup = await html("/login?mode=signup");
  if (signup.body.includes("בואו נבנה")) ok("מעבר למצב הרשמה דרך ה-URL");
  else fail("מצב הרשמה", "הכותרת לא התחלפה");

  const legacy = await html("/forgot-password");
  if ([307, 308].includes(legacy.status) && (legacy.location || "").includes("mode=forgot")) ok("כתובת ישנה מפנה למסך המאוחד", legacy.location || "");
  else fail("הפניית /forgot-password", `סטטוס ${legacy.status} → ${legacy.location}`);
}

// ── 4. הרשאות ───────────────────────────────────────────────────────────────
// במצב הדגמה יש "משתמש" מחובר, ולכן הציפייה שונה: לא 401 אלא דחייה מנומקת.
console.log("\n== הרשאות ==");
{
  const home = await html("/");
  const demoMode = home.body.includes("מצב הדגמה") || (await html("/dashboard")).status === 200;
  console.log(`  (מצב הדגמה: ${demoMode ? "פעיל" : "כבוי"})`);

  const guarded = [
    { path: "/api/cards", body: { slug: "x" }, live: [401], demo: [400] },
    { path: "/api/payments/request", body: { planId: "pro" }, live: [401], demo: [200, 503] },
    { path: "/api/admin/users", body: { email: "a@b.com", fullName: "aa", planId: "trial" }, live: [401, 403], demo: [400, 403] },
  ];

  for (const rule of guarded) {
    const expected = demoMode ? rule.demo : rule.live;
    const result = await post(rule.path, rule.body);
    if (expected.includes(result.status)) ok(`${rule.path} מגיב כמצופה`, `→ ${result.status}`);
    else fail(`${rule.path}`, `ציפינו ל-${expected.join("/")}, קיבלנו ${result.status}`);
  }

  // פעולות ניהול לעולם לא מבצעות שינוי אמיתי במצב הדגמה.
  if (demoMode) {
    const approve = await post("/api/admin/payment-requests/00000000-0000-0000-0000-000000000000", { action: "approve" });
    if ([400, 401, 403].includes(approve.status)) ok("אישור תשלום חסום בהדגמה", `→ ${approve.status}`);
    else fail("אישור תשלום בהדגמה", `סטטוס ${approve.status}`);
  }
}

// ── 5. תשלום בביט — הקישור מכיל את המספר הנכון ──────────────────────────────
console.log("\n== תשלום בביט ==");
{
  const checkout = await html("/checkout?plan=pro");
  if (checkout.status === 200) {
    if (checkout.body.includes("תשלום בביט")) ok("מסך התשלום מציג זרימת ביט");
    else fail("מסך התשלום", "לא נמצא טקסט התשלום בביט");
    if (checkout.body.includes("552951664")) ok("מספר הוואטסאפ לתשלומים מופיע");
    else fail("מספר וואטסאפ", "המספר 0552951664 לא נמצא במסך");
  } else if ([307, 308].includes(checkout.status)) {
    ok("מסך התשלום דורש התחברות", `→ ${checkout.location}`);
  } else {
    fail("מסך התשלום", `סטטוס ${checkout.status}`);
  }
}

// ── 6. סקשנים שיווקיים ──────────────────────────────────────────────────────
console.log("\n== סקשנים בדף הבית ==");
{
  const home = await html("/");
  const sections = [
    ["איך זה עובד", 'id="how-it-works"'],
    ["לקוחות מספרים", 'id="testimonials"'],
    ["הדגמה חיה", 'id="live-demo"'],
    ["שאלות נפוצות", 'id="faq"'],
  ];
  for (const [label, needle] of sections) {
    if (home.body.includes(needle)) ok(`סקשן ${label}`);
    else fail(`סקשן ${label}`, `חסר ${needle}`);
  }

  // כל עוגן בתפריט חייב להתקיים בעמוד
  const anchors = [...home.body.matchAll(/href="\/#([a-z-]+)"/g)].map((match) => match[1]);
  for (const anchor of new Set(anchors)) {
    if (home.body.includes(`id="${anchor}"`)) ok(`עוגן #${anchor} קיים`);
    else fail(`עוגן #${anchor}`, "אין אלמנט תואם");
  }
}

// ── סיכום ───────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`עברו: ${pass} | נכשלו: ${failCount}`);
if (failures.length) {
  console.log("\nכשלים:");
  failures.forEach((item) => console.log(`  - ${item}`));
}
process.exit(failCount === 0 ? 0 : 1);
