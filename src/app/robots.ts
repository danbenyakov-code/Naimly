import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

const privatePaths = ["/dashboard/", "/admin/", "/checkout/", "/onboarding/", "/api/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/", "/legal/accept"];

/*
 * GEO: מנועי תשובות (ChatGPT, Claude, Perplexity, Gemini) סורקים עם
 * זחלנים משלהם. "*" כבר מתיר אותם, אבל רשימה מפורשת מבהירה שהחסימה
 * של אזורים פרטיים חלה גם עליהם — ושהם מוזמנים לשאר האתר.
 */
const answerEngines = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      { userAgent: answerEngines, allow: "/", disallow: privatePaths },
    ],
    sitemap: `${brand.siteUrl}/sitemap.xml`,
    host: brand.siteUrl,
  };
}
