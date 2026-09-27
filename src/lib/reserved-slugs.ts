/**
 * כתובות שכרטיס לא יכול לתפוס, כי הן שייכות לאתר עצמו.
 * בקובץ נפרד מ-validation.ts כדי שקוד שרץ בדפדפן (meta-pixel.ts) לא יגרור את zod.
 */
export const reservedSlugs = new Set(["admin", "api", "auth", "checkout", "dashboard", "login", "signup", "pricing", "legal", "accessibility", "robots.txt", "sitemap.xml", "forgot-password", "reset-password", "_next", "well-known", "favicon.ico", "manifest.webmanifest", "icon.svg", "onboarding", "contact", "llms.txt"]);
