import {
  AtSign, BriefcaseBusiness, CalendarDays, Camera, ExternalLink, Globe2, Mail, Map, MapPin,
  MessageCircle, MessageSquare, Phone, PlayCircle, Send, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import type { CardData, QuickAction, QuickActionType, SmartButton } from "@/lib/types";
import { normalizePhone, whatsappUrl } from "@/lib/utils";
import { safeHref, safeSrc } from "@/lib/safe-url";
import { googleMapsUrl, wazeUrl } from "@/lib/address";
import { resolveActionValue, socialUrl, toE164, whatsappLink } from "@/lib/contact-source";

/**
 * הפעולות של הכרטיס — אייקונים, יעדים ותוויות.
 *
 * הוצא מ-card-preview כדי שגם הכפתור הצף וגם העורך יוכלו לייבא אותו
 * בלי לגרור את רכיב הכרטיס כולו.
 */

/** סדר התצוגה בבורר שבעורך. */
export const quickActionTypes: QuickActionType[] = [
  "phone", "whatsapp", "sms", "email", "gmail", "website",
  "waze", "google_maps", "calendar", "save_contact",
  "instagram", "facebook", "messenger", "telegram", "x", "threads",
  "linkedin", "tiktok", "youtube", "custom",
];

export const actionLabels: Record<QuickActionType, string> = {
  phone: "שיחה", whatsapp: "WhatsApp", sms: "SMS", email: "אימייל", gmail: "Gmail",
  website: "אתר", waze: "Waze", google_maps: "Google Maps", calendar: "קביעת פגישה",
  save_contact: "שמירת איש קשר", instagram: "Instagram", facebook: "Facebook",
  messenger: "Messenger", telegram: "Telegram", x: "X", threads: "Threads",
  linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", custom: "כפתור משלי",
};

/**
 * נתוני הכרטיס נשמרים כ-JSONB בלי אילוץ על סוג הפעולה, ולכן ערך לא מוכר
 * יכול להגיע מייבוא, מלקוח ישן או מתיקון ידני. הרינדור חייב לשרוד אותו:
 * אייקון ברירת מחדל עדיף על עמוד שקורס.
 */
export const actionIcons: Record<QuickActionType, LucideIcon> = {
  phone: Phone, whatsapp: MessageCircle, sms: MessageSquare, email: Mail, gmail: Mail,
  website: Globe2, waze: Map, google_maps: MapPin, calendar: CalendarDays, save_contact: UserPlus,
  instagram: Camera, facebook: Users, messenger: MessageCircle, telegram: Send,
  x: AtSign, threads: AtSign, linkedin: BriefcaseBusiness, tiktok: AtSign,
  youtube: PlayCircle, custom: ExternalLink,
};

/** פעולות שנפתחות באותה לשונית — הן מפעילות אפליקציה, לא אתר. */
const sameTabActions: QuickActionType[] = ["phone", "sms", "email", "gmail", "whatsapp", "save_contact"];

export function opensInSameTab(type: QuickActionType) {
  return sameTabActions.includes(type);
}

/**
 * היעד של הפעולה.
 *
 * QA-024: הערך נגזר ממקור יחיד — פרטי הכרטיס — ולא מעותק בפעולה.
 * מחזיר "" כשאין יעד תקין, כדי שהפעולה לא תוצג כלל.
 */
export function actionHref(action: QuickAction, card: CardData): string {
  const value = resolveActionValue(action, card);

  if (action.type === "phone") return `tel:${normalizePhone(value)}`;

  /*
   * SMS: הפורמט sms: נתמך בכל המכשירים, אך גוף ההודעה נכתב אחרת ב-iOS
   * (&body) וב-Android (?body). בלי גוף ההודעה הקישור עובד בשניהם, ולכן
   * הוא נשאר פשוט — קישור שנפתח עדיף על קישור עם טקסט שלא נפתח.
   */
  if (action.type === "sms") {
    const phone = toE164(value);
    return phone ? `sms:+${phone}` : "";
  }

  // QA-025: wa.me דורש E.164. מספר שלא ניתן לנרמל לא מייצר קישור.
  if (action.type === "whatsapp") return whatsappLink(value, `היי ${card.ownerName}, הגעתי דרך כרטיס הביקור שלך`) || "";

  if (action.type === "email") return value ? `mailto:${value}` : "";

  /*
   * Gmail: חלון הכתיבה של Gmail בדפדפן. בנייד המערכת לרוב מפנה לאפליקציה
   * ממילא, ולכן זו תוספת למי שעובד במחשב ולא תחליף ל-mailto.
   */
  if (action.type === "gmail") {
    const target = value || card.email;
    return target ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target)}` : "";
  }

  if (action.type === "save_contact") return `/api/vcard/${card.slug}`;

  // הכתובת המובנית עדיפה. הערך שהוזן בפעולה משמש רק כגיבוי לכרטיסים ותיקים.
  if (action.type === "waze") {
    return wazeUrl(card.cardAddress) || (value ? `https://www.waze.com/ul?q=${encodeURIComponent(value)}&navigate=yes` : "");
  }
  if (action.type === "google_maps") {
    return googleMapsUrl(card.cardAddress) || (value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}` : "");
  }

  /*
   * כפתור משלי: היעד נקבע במלואו על ידי הלקוח, ולכן הוא עובר דרך
   * safeHref — קישור javascript: או data: בכרטיס ציבורי הוא וקטור תקיפה.
   */
  if (action.type === "custom") return safeHref(value) || "";

  // QA-026: שם משתמש נבנה לכתובת מלאה. "#" הוא קישור שבור שנראה תקין.
  const social = socialUrl(action.type, value);
  if (social) return social;

  return safeHref(value) || "";
}

/** אייקון מותאם שהלקוח העלה, לפעולה מסוג custom. */
export function actionIconUrl(action: QuickAction): string {
  return action.type === "custom" ? safeSrc(action.iconUrl) : "";
}

export function smartButtonHref(button: SmartButton) {
  if (button.action === "phone") return `tel:${normalizePhone(button.value)}`;
  if (button.action === "whatsapp") return whatsappUrl(button.value);
  if (button.action === "email") return `mailto:${button.value}`;
  if (button.action === "waze") return `https://www.waze.com/ul?q=${encodeURIComponent(button.value)}&navigate=yes`;
  if (button.action === "google_maps") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(button.value)}`;
  return safeHref(button.value) || "#";
}

/** הפעולות שמוצגות כשבעל הכרטיס לא הגדיר בעצמו. */
export function defaultActions(card: CardData): QuickAction[] {
  return [
    { id: "phone", type: "phone", label: actionLabels.phone, value: card.phone },
    { id: "whatsapp", type: "whatsapp", label: actionLabels.whatsapp, value: card.whatsapp },
    { id: "email", type: "email", label: actionLabels.email, value: card.email },
    { id: "maps", type: "google_maps", label: "ניווט", value: card.address },
    { id: "website", type: "website", label: actionLabels.website, value: card.website },
  ].filter((action) => Boolean(action.value)) as QuickAction[];
}
