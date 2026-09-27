import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/cookie-consent";
import { FloatingTools } from "@/components/floating-tools";
import { brand, ogImage } from "@/lib/config";
import { homeDescription, homeTitle, seoKeywords } from "@/lib/seo";
import { ConsentedAnalytics } from "@/components/consented-analytics";
import { SitePixel } from "@/components/site-pixel";
import { metaPixelHeadScript, metaPixelNoscriptSrc } from "@/lib/meta-pixel";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // בלי משתנה סביבה, קנוניקל ו-og:image היו יוצאים מול localhost — ומפנים את גוגל לכתובת שלא קיימת.
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: homeTitle,
    template: `%s | ${brand.name}`,
  },
  description: homeDescription,
  applicationName: brand.name,
  keywords: seoKeywords,
  authors: [{ name: brand.name, url: brand.siteUrl }],
  creator: brand.name,
  publisher: brand.name,
  category: "business",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "he_IL", url: "/", siteName: `${brand.name} | ${brand.hebrewName}`, title: `${brand.name} — ${brand.tagline}`, description: "כרטיס דיגיטלי חכם שהופך היכרות לפנייה, עם QR, WhatsApp, לידים ואנליטיקה.", images: [ogImage] },
  twitter: { card: "summary_large_image", title: `${brand.name} — ${brand.tagline}`, description: "כרטיס דיגיטלי חכם שהופך היכרות לפנייה.", images: [ogImage.url] },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  /*
   * אימות בעלות ב-Google Search Console וב-Bing Webmaster Tools — התנאי
   * לשליחת ה-sitemap ולבקשת אינדוקס מהירה. הקודים מגיעים ממשתני סביבה.
   */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      {/* Meta Pixel — קוד הבסיס ב-<head> של כל עמוד, לפי הוראות Meta (ראו meta-pixel.ts). */}
      <head><script id="meta-pixel" dangerouslySetInnerHTML={{ __html: metaPixelHeadScript }} /></head>
      <body className="min-h-full">
        {/* פיקסל מעקב של 1x1 למבקרים בלי JavaScript — לא תמונת תוכן, ולכן לא next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <noscript><img height="1" width="1" style={{ display: "none" }} alt="" src={metaPixelNoscriptSrc} /></noscript>
        <a href="#main-content" className="skip-link">דילוג לתוכן הראשי</a><div id="main-content" tabIndex={-1}>{children}</div><FloatingTools /><CookieConsent /><ConsentedAnalytics /><SitePixel /></body>
    </html>
  );
}
