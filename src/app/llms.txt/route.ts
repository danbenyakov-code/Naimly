import { ANNUAL_DISCOUNT_PERCENT, brand, plans, socialLinks } from "@/lib/config";
import { TRIAL_DAYS } from "@/lib/plan-access";
import { faqs, industries, productDefinition } from "@/lib/seo";

/**
 * llms.txt — תקציר האתר למודלי שפה ומנועי תשובות (GEO), לפי llmstxt.org.
 *
 * נבנה מאותם מקורות שמזינים את האתר (config, seo.ts), כדי שמה שמודל
 * מצטט על המחיר או על המוצר לא יתיישן מול מה שכתוב בדף עצמו.
 */
export function GET() {
  const url = (path: string) => `${brand.siteUrl}${path}`;
  const paidPlans = plans.filter((plan) => plan.price > 0);

  const body = [
    `# ${brand.name} (${brand.hebrewName}) — כרטיס ביקור דיגיטלי ומיני סייט לעסקים`,
    "",
    `> ${productDefinition}`,
    "",
    "## עובדות מרכזיות",
    `- שוק: ישראל. שפות הכרטיס: עברית ואנגלית, מימין לשמאל ומשמאל לימין.`,
    `- ניסיון: ${TRIAL_DAYS} ימים חינם, ללא כרטיס אשראי, עם כל היכולות פתוחות.`,
    ...paidPlans.map((plan) => `- מסלול ${plan.name}: ${plan.price} ש״ח לחודש, לא כולל מע״מ — ${plan.description}`),
    `- תשלום שנתי: משלמים על 10 חודשים ומקבלים 12 (כ-${ANNUAL_DISCOUNT_PERCENT}% הנחה).`,
    "- יכולות: קישור אישי וקוד QR קבוע, WhatsApp וחיוג בלחיצה, ניווט ל-Waze ול-Google Maps, שמירת איש קשר, גלריה, סרטון, קבצים להורדה, טופס לידים, אנליטיקה, Google Analytics / Tag Manager / Meta Pixel.",
    `- מתאים ל: ${industries.join(", ")}.`,
    "",
    "## עמודים",
    `- [דף הבית](${url("/")}): מה זה כרטיס ביקור דיגיטלי, איך זה עובד ושאלות נפוצות`,
    `- [מחירים](${url("/pricing")}): השוואת מסלולים מלאה, חודשי ושנתי`,
    `- [צור קשר](${url("/contact")}): ${brand.supportEmail}`,
    `- [כרטיס לדוגמה](${url("/noa-design")}): כרטיס חי שנבנה במערכת`,
    `- [תנאי שימוש](${url("/legal/terms")}), [מדיניות ביטולים](${url("/legal/refund")}), [פרטיות](${url("/legal/privacy")})`,
    "",
    "## שאלות נפוצות",
    ...faqs.flatMap(([question, answer]) => [`### ${question}`, answer, ""]),
    "## רשתות חברתיות",
    ...socialLinks.map((social) => `- [${social.label}](${social.url})`),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
