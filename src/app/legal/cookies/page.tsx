import type { Metadata } from "next";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";

export const metadata: Metadata = { title: "מדיניות עוגיות", description: `מדיניות העוגיות והמדידה של ${brand.name}.`, alternates: { canonical: "/legal/cookies" } };

export default function CookiesPage() {
  return <LegalPage eyebrow="שליטה ושקיפות" title="מדיניות עוגיות"><p>מדיניות זו מסבירה כיצד {brand.name} משתמשת בעוגיות ובאחסון מקומי באתר, במערכת ובכרטיסים הציבוריים.</p><h2>אחסון הכרחי</h2><p>אנו משתמשים במידע מקומי הנדרש לאימות משתמשים, אבטחה, שמירת העדפת ההסכמה ותפעול בסיסי. רכיבים אלה אינם משמשים לפרסום ואי אפשר להפעיל את השירות באופן תקין בלעדיהם.</p><h2>מדידה ושיווק אופציונליים</h2><p>Google Analytics, Google Tag Manager או Meta Pixel שהוגדרו על ידי בעל כרטיס נטענים רק לאחר בחירה ב״אישור מדידה״. כלים אלה עשויים למדוד צפיות, לחיצות ומאפיינים טכניים בהתאם למדיניות הספק הרלוונטי.</p><h2>משך שמירה</h2><p>משך החיים משתנה לפי סוג הרכיב והספק. העדפת ההסכמה נשמרת בדפדפן עד למחיקתה. ספקי מדידה עשויים להגדיר תקופות נוספות בהתאם להגדרות בעל הכרטיס.</p><h2>שינוי בחירה</h2><p>ניתן לשנות את הבחירה בכל עת. פתיחת ההגדרות מחדש מסירה את ההעדפה הקודמת ומציגה שוב את חלון הבחירה. ניתן גם למחוק עוגיות ואחסון דרך הגדרות הדפדפן.</p><CookieSettingsButton /><h2>יצירת קשר</h2><p>לשאלות בנושא עוגיות ופרטיות ניתן לפנות ל־<a className="font-bold text-[#6d4aff]" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.</p></LegalPage>;
}
