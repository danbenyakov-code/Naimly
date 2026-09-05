import { z } from "zod";
import { isHttpUrl } from "@/lib/safe-url";

// z.string().url() מאשר גם javascript: ו‑data: — ולכן נדרשת בדיקת סכימה מפורשת.
const httpUrl = z.string().max(2000).refine(isHttpUrl, "כתובת חייבת להתחיל ב‑http:// או https://");
const optionalUrl = z.union([z.literal(""), httpUrl]);
const reservedSlugs = new Set(["admin", "api", "auth", "checkout", "dashboard", "login", "signup", "pricing", "legal", "accessibility", "robots.txt", "sitemap.xml", "forgot-password", "reset-password", "_next", "well-known", "favicon.ico", "manifest.webmanifest", "icon.svg"]);

// רק פעולות שמתורגמות ל‑href חופשי נדרשות לבדיקת URL מלאה.
const freeLinkActions = new Set(["website", "instagram", "facebook", "linkedin", "tiktok", "youtube", "calendar"]);
const freeLinkButtonActions = new Set(["url", "booking", "image", "menu"]);

export const authSchema = z.object({
  email: z.string().email("כתובת האימייל אינה תקינה"),
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
});

export const cardSchema = z.object({
  id: z.string().max(100).optional(),
  slug: z.string().min(3, "נדרשים לפחות 3 תווים").max(60).regex(/^[a-z0-9-]+$/, "הקישור יכול לכלול אותיות באנגלית, מספרים ומקף").refine((value) => !reservedSlugs.has(value), "הכתובת הזו שמורה למערכת. יש לבחור כתובת אחרת"),
  businessName: z.string().min(2).max(80),
  ownerName: z.string().min(2).max(80),
  roleTitle: z.string().max(100),
  slogan: z.string().max(140),
  bio: z.string().max(600),
  ctaLabel: z.string().min(2).max(40),
  phone: z.string().max(30),
  whatsapp: z.string().max(30),
  email: z.union([z.literal(""), z.string().email()]),
  website: optionalUrl,
  address: z.string().max(180),
  avatarUrl: optionalUrl,
  coverUrl: optionalUrl,
  logoUrl: optionalUrl,
  logoShape: z.enum(["circle", "rounded", "square"]),
  videoUrl: optionalUrl,
  gallery: z.array(httpUrl).max(100),
  files: z.array(z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(100), url: httpUrl })).max(30),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  headingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bodyTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundPreset: z.enum(["aurora", "midnight", "paper", "sunset", "ocean", "minimal"]),
  template: z.enum(["spotlight", "clean", "bold"]),
  isPublished: z.boolean(),
  allowIndexing: z.boolean(),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(170),
  socialImageUrl: optionalUrl,
  areaServed: z.string().max(120),
  coverAlt: z.string().max(160),
  logoAlt: z.string().max(160),
  avatarAlt: z.string().max(160),
  socialLinks: z.array(z.object({ network: z.enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "x", "threads"]), url: httpUrl })).max(9),
  quickActions: z.array(z.object({
    id: z.string().min(1).max(100),
    type: z.enum(["phone", "whatsapp", "email", "website", "waze", "google_maps", "save_contact", "instagram", "facebook", "linkedin", "tiktok", "youtube", "calendar"]),
    label: z.string().min(1).max(30),
    value: z.string().max(500),
  }).superRefine((action, ctx) => {
    if (freeLinkActions.has(action.type) && action.value && !isHttpUrl(action.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `הקישור של „${action.label}” חייב להתחיל ב‑https://` });
    }
  })).max(9),
  quickActionsLimit: z.union([z.literal(3), z.literal(6), z.literal(9)]),
  smartButtons: z.array(z.object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(60),
    description: z.string().max(140),
    action: z.enum(["url", "phone", "whatsapp", "email", "waze", "google_maps", "booking", "image", "menu"]),
    value: z.string().max(1000),
    imageUrl: optionalUrl.optional(),
  }).superRefine((button, ctx) => {
    if (freeLinkButtonActions.has(button.action) && button.value && !isHttpUrl(button.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `הקישור של הכפתור „${button.label}” חייב להתחיל ב‑https://` });
    }
    if (button.action === "email" && button.value && !z.string().email().safeParse(button.value).success) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `כתובת האימייל של „${button.label}” אינה תקינה` });
    }
  })).max(20),
  widgets: z.array(z.object({
    id: z.string().min(1).max(100),
    type: z.enum(["smart_buttons", "services", "gallery", "video", "testimonials", "hours", "files", "contact_form"]),
    title: z.string().min(1).max(80),
    enabled: z.boolean(),
  })).max(20),
  contactFormTitle: z.string().min(1).max(100),
  contactFormSuccessMessage: z.string().min(1).max(240),
  contactFormFields: z.array(z.object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(80),
    type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
    required: z.boolean(),
    options: z.array(z.string().min(1).max(80)).max(20).optional(),
  })).min(1).max(12),
  galleryStyle: z.enum(["grid", "carousel"]),
  tracking: z.object({
    googleAnalyticsId: z.union([z.literal(""), z.string().regex(/^G-[A-Z0-9]{4,20}$/i, "מזהה Google Analytics אינו תקין")]),
    googleTagManagerId: z.union([z.literal(""), z.string().regex(/^GTM-[A-Z0-9]{4,20}$/i, "מזהה Google Tag Manager אינו תקין")]),
    metaPixelId: z.union([z.literal(""), z.string().regex(/^\d{5,25}$/, "מזהה Meta Pixel אינו תקין")]),
  }),
  vcard: z.object({
    fullName: z.string().min(1).max(100), organization: z.string().max(100), title: z.string().max(100),
    phone: z.string().max(30), email: z.union([z.literal(""), z.string().email()]), website: optionalUrl,
    address: z.string().max(200), note: z.string().max(300),
  }),
  services: z.array(z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(80), description: z.string().max(300), price: z.string().max(50).optional() })).max(30),
  testimonials: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(80), text: z.string().max(500), rating: z.number().int().min(1).max(5) })).max(30),
  businessHours: z.array(z.object({ day: z.string().max(30), hours: z.string().max(50) })).max(10),
});

export const leadSchema = z.object({
  slug: z.string().min(3).max(60),
  name: z.string().min(1, "יש להזין שם").max(80),
  phone: z.string().max(30),
  email: z.union([z.literal(""), z.string().email("כתובת האימייל אינה תקינה")]),
  message: z.string().max(1000),
  fields: z.record(z.string().max(100), z.union([z.string().max(2000), z.boolean()])).optional(),
  website: z.string().max(0).optional(),
});
