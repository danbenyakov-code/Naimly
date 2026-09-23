/**
 * בדיקת דפדפן אמיתית (Playwright) מול deployment של preview.
 *
 * שימוש: node scripts/preview-e2e-check.mjs <preview-url> <email> <password>
 *
 * לא רץ ב-CI וב-test:unit הרגילים — סקריפט חד-פעמי לבדיקת ה-preview
 * הזה של תהליך הרכישה, לפני שמיגרציות 029/030 מוחלות בפרודקשן.
 */
import { chromium } from "playwright";

const [, , baseUrl, email, password] = process.argv;
if (!baseUrl || !email || !password) {
  console.error("שימוש: node scripts/preview-e2e-check.mjs <url> <email> <password>");
  process.exit(1);
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => { if (msg.type() === "error") console.log("  [console error]", msg.text().slice(0, 200)); });

async function dismissCookieBanner() {
  try {
    const acceptButton = page.getByRole("button", { name: "קבלת הכול" });
    await acceptButton.waitFor({ state: "visible", timeout: 4000 });
    await acceptButton.click();
    await acceptButton.waitFor({ state: "hidden", timeout: 4000 }).catch(() => null);
  } catch {
    // אין באנר עוגיות בעמוד הזה, או שכבר נסגר — לא כשל.
  }
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await dismissCookieBanner();
  await page.locator('button[type="submit"]').first().click({ force: true });
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => null);
  record("התחברות", page.url().includes("/dashboard"), page.url());

  await page.goto(`${baseUrl}/dashboard/orders`, { waitUntil: "domcontentloaded" });
  const ordersBodyText = await page.locator("body").innerText().catch(() => "");
  const ordersServerError = ordersBodyText.includes("Application error") || ordersBodyText.includes("500");
  record("מסך /dashboard/orders נטען בלי קריסת שרת", !ordersServerError, ordersServerError ? ordersBodyText.slice(0, 200) : "נטען תקין");

  await page.goto(`${baseUrl}/checkout?plan=basic`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner();
  const checkoutBodyText = await page.locator("body").innerText().catch(() => "");
  const checkoutServerError = checkoutBodyText.includes("Application error") || checkoutBodyText.includes("500");
  record("מסך /checkout נטען בלי קריסת שרת", !checkoutServerError, checkoutServerError ? checkoutBodyText.slice(0, 200) : "נטען תקין");

  if (!checkoutServerError) {
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.count()) await checkbox.check({ force: true }).catch(() => null);
    await dismissCookieBanner();
    const submitButton = page.locator('button[type="button"]', { hasText: /רכישה|תשלום/ }).first();
    if (await submitButton.count()) {
      let apiStatus = "";
      let apiBody = "";
      page.on("response", (response) => {
        if (response.url().includes("/api/payments/request")) {
          apiStatus = String(response.status());
          response.text().then((text) => { apiBody = text.slice(0, 400); }).catch(() => null);
        }
      });
      await submitButton.click({ force: true });
      await page.waitForTimeout(3000);
      const afterSubmitText = await page.locator("body").innerText().catch(() => "");
      const gotReference = afterSubmitText.includes("מספר עסקה") || afterSubmitText.includes("בקשת הרכישה התקבלה");
      record("שליחת בקשת רכישה", gotReference, gotReference ? "התקבל מספר עסקה" : `HTTP ${apiStatus || "?"} — ${apiBody || afterSubmitText.slice(0, 300)}`);
    } else {
      record("שליחת בקשת רכישה", false, "לא נמצא כפתור שליחה בדף — ייתכן שהמסלול נעול או שהעמוד השתנה");
    }
  }
} catch (error) {
  record("ריצה כללית", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} עברו.`);
process.exit(failed > 0 ? 1 : 0);
