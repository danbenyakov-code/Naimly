import { chromium } from "playwright";

const [, , baseUrl, email, password] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage();

async function dismissCookieBanner() {
  try {
    const acceptButton = page.getByRole("button", { name: "קבלת הכול" });
    await acceptButton.waitFor({ state: "visible", timeout: 4000 });
    await acceptButton.click();
  } catch { /* not present */ }
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await dismissCookieBanner();
  await page.locator('button[type="submit"]').first().click({ force: true });
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => null);

  await page.goto(`${baseUrl}/admin/payments`, { waitUntil: "domcontentloaded" });
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const isError = bodyText.includes("Application error") || bodyText.includes("500");
  const hasHeading = bodyText.includes("תשלומים ולקוחות");
  const hasNewRequest = bodyText.includes("ממתין לבדיקת מנהל") || bodyText.includes("בקשות חדשות");
  console.log(isError ? "❌ שגיאת שרת" : "✅ /admin/payments נטען");
  console.log(hasHeading ? "✅ הכותרת הנכונה מוצגת" : "❌ כותרת חסרה");
  console.log(hasNewRequest ? "✅ נראים ממצאים בתשלומים" : "⚠️ לא ברור אם יש נתונים");
  console.log("\n--- קטע מהעמוד ---\n" + bodyText.slice(0, 600));
} catch (error) {
  console.error("FAILED", error.message);
  process.exit(1);
} finally {
  await browser.close();
}
