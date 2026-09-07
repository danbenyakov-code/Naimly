import type { StructuredAddress } from "@/lib/address";
import { formatAddress, parseCoordinates } from "@/lib/address";

/**
 * יצירת vCard 3.0.
 *
 * נבחרה גרסה 3.0 ולא 4.0 כי היא הנתמכת ביותר באפליקציות אנשי הקשר של
 * iOS ואנדרואיד. הקובץ ב-UTF-8 עם שורות CRLF, כנדרש ב-RFC 2426.
 *
 * רק שדות שבעל הכרטיס בחר לפרסם נכנסים לקובץ — שדה ריק אינו נכתב כלל,
 * כדי לא ליצור אנשי קשר עם שורות חלולות.
 */

export type VCardInput = {
  firstName: string;
  lastName: string;
  /** שם לתצוגה. כשריק — מורכב מפרטי ומשפחה. */
  displayName: string;
  organization: string;
  title: string;
  mobile: string;
  phone: string;
  email: string;
  website: string;
  address: Partial<StructuredAddress>;
  note: string;
  /** כתובת תמונה. נכנסת כ-URL ולא כ-base64, כדי לא לנפח את הקובץ. */
  photoUrl?: string;
};

/**
 * המלטה לפי RFC 2426: קודם לוכסן אחורי, אחר כך פסיק ונקודה-פסיק,
 * ולבסוף שורות חדשות. תווי בקרה מוסרים — הם מאפשרים הזרקת שדות.
 */
export function escapeVCardValue(value: string) {
  return Array.from(String(value ?? ""))
    .filter((char) => {
      const code = char.codePointAt(0)!;
      // שומרים על שורה חדשה כדי להמיר אותה ל-\n מילולי בהמשך.
      if (char === "\n" || char === "\r") return true;
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n?|\n/g, "\\n")
    .slice(0, 500);
}

/** שם קובץ בטוח — אותיות אנגליות, ספרות ומקף בלבד. */
export function safeVCardFilename(slug: string) {
  const clean = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${clean || "contact"}.vcf`;
}

/** שורה בקובץ. מוחזר null כשהערך ריק, כדי לא לכתוב שדות חלולים. */
function line(property: string, value: string): string | null {
  const escaped = escapeVCardValue(value);
  return escaped.trim() ? `${property}:${escaped}` : null;
}

export function buildVCard(input: VCardInput): string {
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const displayName = String(input.displayName || "").trim() || [firstName, lastName].filter(Boolean).join(" ");

  const lines: Array<string | null> = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    // N מחייב חמישה חלקים מופרדים בנקודה-פסיק, גם כשהם ריקים.
    `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`,
    line("FN", displayName),
    line("ORG", input.organization),
    line("TITLE", input.title),
    line("TEL;TYPE=CELL,VOICE", input.mobile),
    line("TEL;TYPE=WORK,VOICE", input.phone),
    line("EMAIL;TYPE=INTERNET,PREF", input.email),
    line("URL", input.website),
  ];

  // ADR: ;;רחוב;עיר;אזור;מיקוד;מדינה
  const address = input.address || {};
  const street = [address.street, address.houseNumber].filter(Boolean).join(" ").trim();
  const hasAddress = [street, address.city, address.postalCode, address.country].some((part) => String(part || "").trim());
  if (hasAddress) {
    lines.push(
      `ADR;TYPE=WORK:;;${escapeVCardValue(street)};${escapeVCardValue(address.city || "")};;${escapeVCardValue(address.postalCode || "")};${escapeVCardValue(address.country || "")}`,
    );
    const formatted = formatAddress(address);
    if (formatted) lines.push(line("LABEL;TYPE=WORK", formatted));
  }

  const coordinates = parseCoordinates(address.latitude || "", address.longitude || "");
  if (coordinates) lines.push(`GEO:${coordinates.lat};${coordinates.lon}`);

  if (input.photoUrl && /^https?:\/\//i.test(input.photoUrl)) {
    lines.push(`PHOTO;VALUE=URI:${input.photoUrl}`);
  }

  lines.push(line("NOTE", input.note));
  lines.push("END:VCARD");

  return lines.filter((value): value is string => Boolean(value)).join("\r\n");
}

/** כותרות ההורדה לתשובת HTTP. */
export function vCardHeaders(slug: string) {
  return {
    "content-type": "text/vcard; charset=utf-8",
    "content-disposition": `attachment; filename="${safeVCardFilename(slug)}"`,
    "cache-control": "public, max-age=300",
  };
}
