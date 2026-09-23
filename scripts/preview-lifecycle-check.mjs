/**
 * בדיקת מחזור חיים מלא של בקשת רכישה, דרך דפדפן אמיתי.
 * danbenyakov@gmail.com הוא גם הלקוח (יצר את הבקשה) וגם האדמין כאן,
 * ולכן כל השלבים רצים באותו session בלי צורך בחשבון שני.
 */
import { chromium } from "playwright";

const [, , baseUrl, email, password] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("dialog", (dialog) => dialog.accept()); // window.prompt/confirm בקוד הלוח

async function dismissCookieBanner() {
  try {
    const btn = page.getByRole("button", { name: "קבלת הכול" });
    await btn.waitFor({ state: "visible", timeout: 3000 });
    await btn.click();
  } catch { /* אין באנר */ }
}

function step(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  return ok;
}

async function clickButtonWithText(text) {
  const btn = page.locator("button", { hasText: text }).first();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click({ force: true });
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await dismissCookieBanner();
  await page.locator('button[type="submit"]').first().click({ force: true });
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => null);
  step("התחברות", page.url().includes("/dashboard"));

  await page.goto(`${baseUrl}/admin/payments`, { waitUntil: "networkidle" });
  await dismissCookieBanner();
  await page.waitForTimeout(1000);

  // שלב 1: אישור עקרוני
  await clickButtonWithText("אישור עקרוני");
  await page.waitForTimeout(2000);
  let bodyText = await page.locator("body").innerText();
  step("אישור עקרוני", bodyText.includes("אושרה עקרונית") || bodyText.includes("אושר עקרונית"));

  // שלב 2: שליחת קישור תשלום
  await clickButtonWithText("שליחת קישור תשלום");
  await page.waitForTimeout(2500);
  bodyText = await page.locator("body").innerText();
  step("שליחת קישור תשלום", bodyText.includes("קישור תשלום נשלח") || bodyText.includes("קישור תשלום נשלח ל"));

  // שלב 3: הלקוח (אותו חשבון) מדווח ששילם, דרך "ההזמנה שלי"
  await page.goto(`${baseUrl}/dashboard/orders`, { waitUntil: "networkidle" });
  await dismissCookieBanner();
  await page.waitForTimeout(1000);
  await clickButtonWithText("שילמתי");
  await page.waitForTimeout(2000);
  bodyText = await page.locator("body").innerText();
  step("דיווח לקוח 'שילמתי'", bodyText.includes("בדיקה") || !bodyText.includes("שילמתי"));

  // שלב 4: אדמין מאשר קבלת תשלום
  await page.goto(`${baseUrl}/admin/payments`, { waitUntil: "networkidle" });
  await dismissCookieBanner();
  await page.waitForTimeout(1000);
  await clickButtonWithText("אישור קבלת תשלום");
  await page.waitForTimeout(1000);
  await clickButtonWithText("אישור קבלת תשלום"); // הכפתור בטופס הפנימי, אחרי פתיחתו
  await page.waitForTimeout(2500);
  bodyText = await page.locator("body").innerText();
  step("אימות תשלום", bodyText.includes("אומת") && bodyText.includes("ממתין להפעלה"));

  // שלב 5: הפעלת החבילה (עם דיאלוג אישור מותאם)
  await clickButtonWithText("הפעלת החבילה");
  await page.waitForTimeout(500);
  await clickButtonWithText("אישור"); // כפתור האישור בתוך ה-ConfirmDialog
  await page.waitForTimeout(3000);
  bodyText = await page.locator("body").innerText();
  step("הפעלת החבילה", bodyText.includes("הופעל עבור") || bodyText.includes("פעיל"));

  console.log("\n--- מצב סופי בעמוד ---");
  console.log(bodyText.slice(0, 400));
} catch (error) {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
