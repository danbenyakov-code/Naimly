import {
  AtSign, Award, BadgeCheck, Banknote, BookOpen, Briefcase, BriefcaseBusiness, Building2, Calculator,
  CalendarDays, Camera, Car, ChefHat, Clock3, Coffee, CreditCard, Dumbbell, ExternalLink, FileText,
  Film, Flower2, Gift, GraduationCap, Hammer, HandHeart, HeartPulse, Home, Image,
  Laptop, Leaf, Lightbulb, Link2, Locate, Mail, Map as MapIcon, MapPin, MessageCircle, Mic, Music, Newspaper,
  Package, Palette, PawPrint, Phone, PlayCircle, Plane, Scale, Scissors, ShoppingBag, ShoppingCart,
  Smartphone, Sparkles, Star, Stethoscope, Store, Truck, Users, Utensils, Video, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * רישום אייקונים לבורר.
 *
 * הרישום מפורש ולא ייבוא של כל ספריית lucide — כך רק האייקונים שבשימוש
 * נכנסים ל-bundle, במקום מאות אייקונים שאיש לא בחר.
 */
export type IconCategory = "contact" | "business" | "food" | "health" | "beauty" | "trades" | "media" | "education" | "commerce" | "general";

export type IconEntry = {
  id: string;
  label: string;
  category: IconCategory;
  Icon: LucideIcon;
  keywords?: string[];
};

export const iconCategories: Array<{ id: IconCategory; label: string }> = [
  { id: "contact", label: "יצירת קשר" },
  { id: "business", label: "עסקי" },
  { id: "commerce", label: "מסחר" },
  { id: "food", label: "מזון" },
  { id: "health", label: "בריאות" },
  { id: "beauty", label: "יופי" },
  { id: "trades", label: "מקצועות" },
  { id: "media", label: "מדיה" },
  { id: "education", label: "לימודים" },
  { id: "general", label: "כללי" },
];

export const iconRegistry: IconEntry[] = [
  // יצירת קשר
  { id: "phone", label: "טלפון", category: "contact", Icon: Phone, keywords: ["חיוג", "שיחה"] },
  { id: "message-circle", label: "וואטסאפ", category: "contact", Icon: MessageCircle, keywords: ["הודעה", "צ׳אט"] },
  { id: "mail", label: "אימייל", category: "contact", Icon: Mail, keywords: ["דואר", "מייל"] },
  { id: "smartphone", label: "נייד", category: "contact", Icon: Smartphone, keywords: ["סלולר"] },
  { id: "map-pin", label: "מיקום", category: "contact", Icon: MapPin, keywords: ["כתובת", "ניווט"] },
  { id: "map", label: "מפה", category: "contact", Icon: MapIcon, keywords: ["waze", "ניווט"] },
  { id: "locate", label: "איתור", category: "contact", Icon: Locate, keywords: ["gps"] },
  { id: "calendar", label: "קביעת פגישה", category: "contact", Icon: CalendarDays, keywords: ["יומן", "תור"] },
  { id: "clock", label: "שעות פעילות", category: "contact", Icon: Clock3, keywords: ["זמן"] },
  { id: "link", label: "קישור", category: "contact", Icon: Link2, keywords: ["url"] },
  { id: "external-link", label: "קישור חיצוני", category: "contact", Icon: ExternalLink },
  { id: "at-sign", label: "רשת חברתית", category: "contact", Icon: AtSign, keywords: ["טיקטוק"] },
  { id: "instagram", label: "אינסטגרם", category: "contact", Icon: Camera, keywords: ["רשת", "סושיאל"] },

  // עסקי
  { id: "briefcase", label: "תיק עבודות", category: "business", Icon: Briefcase, keywords: ["פורטפוליו"] },
  { id: "briefcase-business", label: "עסק", category: "business", Icon: BriefcaseBusiness, keywords: ["לינקדאין"] },
  { id: "building", label: "משרד", category: "business", Icon: Building2, keywords: ["חברה"] },
  { id: "users", label: "צוות", category: "business", Icon: Users, keywords: ["אנשים", "לקוחות"] },
  { id: "award", label: "הסמכה", category: "business", Icon: Award, keywords: ["פרס", "תעודה"] },
  { id: "badge-check", label: "אמינות", category: "business", Icon: BadgeCheck, keywords: ["מאומת"] },
  { id: "file-text", label: "מסמך", category: "business", Icon: FileText, keywords: ["קובץ", "הצעה"] },
  { id: "calculator", label: "מחשבון", category: "business", Icon: Calculator, keywords: ["הצעת מחיר"] },
  { id: "scale", label: "משפטי", category: "business", Icon: Scale, keywords: ["עורך דין", "צדק"] },
  { id: "lightbulb", label: "רעיון", category: "business", Icon: Lightbulb, keywords: ["ייעוץ"] },

  // מסחר
  { id: "shopping-cart", label: "עגלת קניות", category: "commerce", Icon: ShoppingCart, keywords: ["חנות"] },
  { id: "shopping-bag", label: "קנייה", category: "commerce", Icon: ShoppingBag, keywords: ["מוצר"] },
  { id: "store", label: "חנות", category: "commerce", Icon: Store, keywords: ["סניף"] },
  { id: "credit-card", label: "תשלום", category: "commerce", Icon: CreditCard, keywords: ["אשראי"] },
  { id: "banknote", label: "מחיר", category: "commerce", Icon: Banknote, keywords: ["כסף"] },
  { id: "wallet", label: "ארנק", category: "commerce", Icon: Wallet, keywords: ["ביט"] },
  { id: "package", label: "משלוח", category: "commerce", Icon: Package, keywords: ["חבילה"] },
  { id: "truck", label: "הובלה", category: "commerce", Icon: Truck, keywords: ["שילוח"] },
  { id: "gift", label: "מבצע", category: "commerce", Icon: Gift, keywords: ["מתנה", "הטבה"] },

  // מזון
  { id: "utensils", label: "מסעדה", category: "food", Icon: Utensils, keywords: ["תפריט", "אוכל"] },
  { id: "chef-hat", label: "שף", category: "food", Icon: ChefHat, keywords: ["בישול", "קייטרינג"] },
  { id: "coffee", label: "בית קפה", category: "food", Icon: Coffee, keywords: ["קפה"] },

  // בריאות
  { id: "heart-pulse", label: "בריאות", category: "health", Icon: HeartPulse, keywords: ["רפואה"] },
  { id: "stethoscope", label: "קליניקה", category: "health", Icon: Stethoscope, keywords: ["רופא"] },
  { id: "dumbbell", label: "כושר", category: "health", Icon: Dumbbell, keywords: ["אימון", "חדר כושר"] },
  { id: "hand-heart", label: "טיפול", category: "health", Icon: HandHeart, keywords: ["רווחה"] },
  { id: "leaf", label: "טבעי", category: "health", Icon: Leaf, keywords: ["אורגני"] },

  // יופי
  { id: "scissors", label: "מספרה", category: "beauty", Icon: Scissors, keywords: ["תספורת"] },
  { id: "sparkles", label: "יופי", category: "beauty", Icon: Sparkles, keywords: ["קוסמטיקה"] },
  { id: "flower", label: "פרחים", category: "beauty", Icon: Flower2, keywords: ["ספא"] },
  { id: "palette", label: "עיצוב", category: "beauty", Icon: Palette, keywords: ["צבע", "אמנות"] },

  // מקצועות
  { id: "wrench", label: "תיקונים", category: "trades", Icon: Wrench, keywords: ["אינסטלציה"] },
  { id: "hammer", label: "שיפוצים", category: "trades", Icon: Hammer, keywords: ["בנייה", "נגרות"] },
  { id: "home", label: "נדל״ן", category: "trades", Icon: Home, keywords: ["בית", "דירה"] },
  { id: "car", label: "רכב", category: "trades", Icon: Car, keywords: ["מוסך"] },
  { id: "plane", label: "נסיעות", category: "trades", Icon: Plane, keywords: ["תיירות", "טיסות"] },
  { id: "paw-print", label: "חיות", category: "trades", Icon: PawPrint, keywords: ["וטרינר"] },

  // מדיה
  { id: "camera", label: "צילום", category: "media", Icon: Camera, keywords: ["תמונות"] },
  { id: "image", label: "גלריה", category: "media", Icon: Image, keywords: ["תמונה"] },
  { id: "video", label: "וידאו", category: "media", Icon: Video, keywords: ["סרטון"] },
  { id: "play", label: "נגן", category: "media", Icon: PlayCircle, keywords: ["יוטיוב"] },
  { id: "film", label: "הפקה", category: "media", Icon: Film, keywords: ["קולנוע"] },
  { id: "mic", label: "פודקאסט", category: "media", Icon: Mic, keywords: ["הקלטה"] },
  { id: "music", label: "מוזיקה", category: "media", Icon: Music, keywords: ["הופעה"] },
  { id: "newspaper", label: "פרסום", category: "media", Icon: Newspaper, keywords: ["כתבה"] },

  // לימודים
  { id: "graduation-cap", label: "הדרכה", category: "education", Icon: GraduationCap, keywords: ["קורס", "לימודים"] },
  { id: "book-open", label: "מדריך", category: "education", Icon: BookOpen, keywords: ["ספר", "תוכן"] },
  { id: "laptop", label: "אונליין", category: "education", Icon: Laptop, keywords: ["מחשב", "וובינר"] },

  // כללי
  { id: "star", label: "מומלץ", category: "general", Icon: Star, keywords: ["דירוג", "המלצה"] },
];

const byId = new Map(iconRegistry.map((entry) => [entry.id, entry]));

export const DEFAULT_ICON_ID = "link";

export function getIcon(id: string): IconEntry {
  return byId.get(id) || byId.get(DEFAULT_ICON_ID)!;
}

export function isIconId(id: string) {
  return byId.has(id);
}

export function categoryLabel(category: IconCategory) {
  return iconCategories.find((entry) => entry.id === category)?.label || category;
}

export function countByCategory(category: IconCategory) {
  return iconRegistry.filter((entry) => entry.category === category).length;
}

/** חיפוש בשם, במזהה, בקטגוריה ובמילות המפתח. */
export function searchIcons(query: string, category?: IconCategory | "all") {
  const term = query.trim().toLowerCase();
  return iconRegistry.filter((entry) => {
    if (category && category !== "all" && entry.category !== category) return false;
    if (!term) return true;
    const haystack = [entry.label, entry.id, categoryLabel(entry.category), ...(entry.keywords || [])].join(" ").toLowerCase();
    return haystack.includes(term);
  });
}

/** האייקון המומלץ לסוג פעולה, כברירת מחדל בבחירה. */
export function suggestedIconFor(action: string): string {
  const map: Record<string, string> = {
    phone: "phone",
    whatsapp: "message-circle",
    email: "mail",
    website: "external-link",
    waze: "map",
    google_maps: "map-pin",
    save_contact: "badge-check",
    calendar: "calendar",
    booking: "calendar",
    menu: "utensils",
    image: "image",
    url: "link",
  };
  return map[action] || DEFAULT_ICON_ID;
}
