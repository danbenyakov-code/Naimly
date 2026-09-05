import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/cookie-consent";
import { FloatingTools } from "@/components/floating-tools";
import { brand } from "@/lib/config";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: `${brand.name} | כרטיס ביקור דיגיטלי שעובד בשבילך`,
    template: `%s | ${brand.name}`,
  },
  description:
    "בונים כרטיס ביקור דיגיטלי מקצועי, משתפים בקישור או QR ורואים מה באמת עובד — בלי ידע טכני.",
  applicationName: brand.name,
  keywords: ["כרטיס ביקור דיגיטלי", "כרטיס דיגיטלי לעסק", "מיני אתר לעסק", "QR לעסק", "כרטיס ביקור אונליין"],
  authors: [{ name: brand.name, url: brand.siteUrl }],
  creator: brand.name,
  publisher: brand.name,
  category: "business",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "he_IL", url: "/", siteName: `${brand.name} | ${brand.hebrewName}`, title: `${brand.name} — ${brand.tagline}`, description: "כרטיס דיגיטלי חכם שהופך היכרות לפנייה, עם QR, WhatsApp, לידים ואנליטיקה." },
  twitter: { card: "summary_large_image", title: `${brand.name} — ${brand.tagline}`, description: "כרטיס דיגיטלי חכם שהופך היכרות לפנייה." },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full"><a href="#main-content" className="skip-link">דילוג לתוכן הראשי</a><div id="main-content" tabIndex={-1}>{children}</div><FloatingTools /><CookieConsent /></body>
    </html>
  );
}
