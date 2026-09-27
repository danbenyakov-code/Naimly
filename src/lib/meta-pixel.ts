import { siteMetaPixelId } from "@/lib/config";
import { reservedSlugs } from "@/lib/reserved-slugs";

/**
 * קוד הבסיס של Meta Pixel כפי ש-Meta מספקת אותו, בתוך ה-<head> של כל עמוד.
 *
 * תוספת אחת בלבד: דילוג על כרטיסי לקוחות. שם נטען הפיקסל של בעל הכרטיס,
 * ו-fbq('track') שולח לכל פיקסל שאותחל בדף — שני פיקסלים יחד היו
 * מערבבים את האירועים של NAIMLY ושל הלקוח. עמוד "של האתר" = דף הבית
 * או נתיב שמור (reservedSlugs), אותה רשימה שאוסרת על כרטיס לתפוס אותו.
 *
 * מעברי עמוד בתוך האתר (pushState) נספרים אוטומטית על ידי fbevents.js —
 * קריאה ידנית ל-PageView בכל ניווט הייתה מכפילה כל אירוע.
 */
export const metaPixelHeadScript = `(function(){var seg=location.pathname.split('/')[1]||'';var site=${JSON.stringify([...reservedSlugs])};if(seg!==''&&site.indexOf(seg)===-1)return;
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${siteMetaPixelId}');
fbq('track', 'PageView');
})();`;

export const metaPixelNoscriptSrc = `https://www.facebook.com/tr?id=${siteMetaPixelId}&ev=PageView&noscript=1`;
