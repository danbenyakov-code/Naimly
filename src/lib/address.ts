/**
 * כתובת מובנית וקישורי ניווט.
 *
 * הלקוח לא נדרש להדביק כתובות URL של Waze או Google Maps. הוא ממלא שדות
 * (מדינה, עיר, רחוב, מספר, מיקוד, ואופציונלית נ.צ.) והמערכת בונה את
 * הקישורים בעצמה, מקודדת כראוי.
 */

export type StructuredAddress = {
  country: string;
  city: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  /** נ.צ. אופציונליים. כשקיימים — מדויקים יותר מכתובת טקסטואלית. */
  latitude: string;
  longitude: string;
  /** הערה חופשית שתוצג לצד הכתובת (קומה, כניסה). */
  note: string;
};

export const emptyAddress: StructuredAddress = {
  country: "ישראל",
  city: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  note: "",
};

/** נ.צ. תקינים בלבד. קווי רוחב ±90, קווי אורך ±180. */
export function parseCoordinates(latitude: string, longitude: string) {
  const lat = Number(String(latitude).trim());
  const lon = Number(String(longitude).trim());
  if (!String(latitude).trim() || !String(longitude).trim()) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // 0,0 הוא כמעט תמיד שדה שנשאר ריק ולא מקום אמיתי.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/** כתובת קריאה בשורה אחת, לתצוגה ולשימוש בקישורים. */
export function formatAddress(address: Partial<StructuredAddress>) {
  const street = [address.street, address.houseNumber].filter(Boolean).join(" ").trim();
  return [street, address.city, address.postalCode, address.country]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

/** האם יש מספיק מידע לבניית קישור ניווט. */
export function hasNavigableAddress(address: Partial<StructuredAddress>) {
  if (parseCoordinates(address.latitude || "", address.longitude || "")) return true;
  // בלי עיר אין לאן לנווט; רחוב לבדו אינו מספיק.
  return Boolean(String(address.city || "").trim() && String(address.street || "").trim());
}

/** מה חסר כדי ליצור קישור ניווט — לשימוש בהודעת שגיאה מדויקת. */
export function missingAddressFields(address: Partial<StructuredAddress>): string[] {
  if (parseCoordinates(address.latitude || "", address.longitude || "")) return [];
  const missing: string[] = [];
  if (!String(address.city || "").trim()) missing.push("עיר");
  if (!String(address.street || "").trim()) missing.push("רחוב");
  return missing;
}

/**
 * קישור ניווט ל-Waze. כשיש נ.צ. הם מועדפים, כי הם מדויקים ואינם תלויים
 * בפירוש הכתובת אצל הספק.
 */
export function wazeUrl(address: Partial<StructuredAddress>) {
  const coordinates = parseCoordinates(address.latitude || "", address.longitude || "");
  if (coordinates) {
    return `https://www.waze.com/ul?ll=${coordinates.lat}%2C${coordinates.lon}&navigate=yes`;
  }
  const formatted = formatAddress(address);
  if (!formatted) return "";
  return `https://www.waze.com/ul?q=${encodeURIComponent(formatted)}&navigate=yes`;
}

/** קישור ניווט ל-Google Maps. */
export function googleMapsUrl(address: Partial<StructuredAddress>) {
  const coordinates = parseCoordinates(address.latitude || "", address.longitude || "");
  if (coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${coordinates.lat}%2C${coordinates.lon}`;
  }
  const formatted = formatAddress(address);
  if (!formatted) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}`;
}

/**
 * ממיר כתובת טקסט חופשי לשדות מובנים, כמאמץ מיטבי.
 * משמש להעברת נתונים קיימים בלי לאבד אותם.
 */
export function parseFreeTextAddress(value: string): StructuredAddress {
  const text = String(value || "").trim();
  if (!text) return { ...emptyAddress };

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  const result: StructuredAddress = { ...emptyAddress, country: "ישראל" };

  // החלק הראשון הוא בדרך כלל "רחוב ומספר".
  const streetPart = parts[0] || "";
  const houseMatch = streetPart.match(/^(.*?)\s+(\d+[א-ת]?)\s*$/);
  if (houseMatch) {
    result.street = houseMatch[1].trim();
    result.houseNumber = houseMatch[2].trim();
  } else {
    result.street = streetPart;
  }

  if (parts[1]) result.city = parts[1];
  // מיקוד ישראלי: 5 או 7 ספרות.
  const postal = parts.find((part) => /^\d{5}$|^\d{7}$/.test(part));
  if (postal) result.postalCode = postal;

  return result;
}
