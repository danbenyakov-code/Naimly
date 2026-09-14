/**
 * זריעת כרטיסי התצוגה כשורות אמיתיות במסד.
 *
 * QA-013: /api/leads מחפש את הכרטיס לפי slug במסד. כרטיס שהוגש מהקוד
 * בלבד לא נמצא, וכל פנייה ממנו נכשלה ב-404. אותו פער חל על אירועי
 * צפייה ולחיצה, שנשמרים לפי card_id.
 *
 * REQ-007: נדרשים לפחות שלושה כרטיסים שנטענים בפועל, בלי פרטי דמה
 * ועם פעולות בטוחות. כרטיס אחד שמוצג שלוש פעמים בדף הבית אינו שלושה.
 *
 * המחירים נגזרים מ-plans ואינם מוקלדים: הכרטיס הציבורי פרסם "פרימיום
 * 119 ₪ ותמיכה מועדפת" חודשים אחרי שהמחירון השתנה, כי המספר הוקלד כאן.
 *
 * שימוש:
 *   node --experimental-strip-types --import ./tests/alias-loader.mjs scripts/seed-showcase-cards.mjs
 *   ... --apply --site=https://naimly-mu.vercel.app
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

const { plans } = await import("../src/lib/config.ts");
const { planLimits } = await import("../src/lib/plan-access.ts");

const apply = process.argv.includes("--apply");
const siteArg = process.argv.find((a) => a.startsWith("--site="));
const site = siteArg ? siteArg.slice(7) : "https://naimly-mu.vercel.app";
const ownerEmail = (process.argv.find((a) => a.startsWith("--owner=")) || "--owner=danbenyakov@gmail.com").slice(8);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: owner } = await admin.from("profiles").select("id,email").eq("email", ownerEmail).maybeSingle();
if (!owner) {
  console.error(`\n❌ לא נמצא חשבון ${ownerEmail} שיחזיק את כרטיסי התצוגה.\n`);
  process.exit(1);
}

const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "info.naimly@gmail.com";
const whatsapp = process.env.NEXT_PUBLIC_BILLING_WHATSAPP || "972552951664";
const phone = process.env.NEXT_PUBLIC_BIT_PHONE || "055-295-1664";

/** המסלולים כפי שהם בפועל, לתצוגה בכרטיס. */
const planServices = plans
  .filter((plan) => plan.price > 0)
  .map((plan) => {
    const limits = planLimits(plan.id);
    const parts = [
      `${limits.quickActions} פעולות מהירות`,
      `${limits.galleryItems} תמונות`,
      limits.videos === 0 ? "ללא סרטון" : limits.videos === 1 ? "סרטון אחד" : `${limits.videos} סרטונים`,
      limits.cards > 1 ? `${limits.cards} כרטיסים` : null,
    ].filter(Boolean);
    return {
      id: `s-${plan.id}`,
      title: plan.name,
      description: parts.join(" · "),
      price: `${plan.price} ₪ לחודש`,
    };
  });

/** בסיס משותף: פעולות בטוחות שכולן מובילות ליעד פעיל של NAIMLY. */
const base = {
  user_id: owner.id,
  phone,
  whatsapp,
  email: support,
  website: site,
  is_published: true,
  allow_indexing: true,
  area_served: "ישראל",
  gallery_style: "grid",
  quick_actions_limit: 9,
  quick_actions: [
    { id: "qa-phone", type: "phone", label: "שיחה", icon: "phone", value: "" },
    { id: "qa-whatsapp", type: "whatsapp", label: "וואטסאפ", icon: "message-circle", value: "" },
    { id: "qa-email", type: "email", label: "אימייל", icon: "mail", value: "" },
    { id: "qa-site", type: "website", label: "לאתר", icon: "link", value: "" },
    { id: "qa-save", type: "save_contact", label: "שמירת איש קשר", icon: "user-plus", value: "" },
  ],
  testimonials: [],
  social_links: [],
  contact_form_success_message: "קיבלנו את הפנייה ונחזור אליך בהקדם.",
  // ה-vCard נגזר מהכרטיס דרך resolveVCard, ולכן נשאר ריק בכוונה.
  vcard: {
    fullName: "", firstName: "", lastName: "", organization: "", title: "",
    phone: "", phoneSecondary: "", email: "", website: "", address: "", note: "",
    includePhoto: false,
  },
};

const hours = [
  { day: "ראשון–חמישי", hours: "09:00–18:00" },
  { day: "שישי", hours: "09:00–13:00" },
  { day: "שבת", hours: "סגור" },
];

/*
 * שלושה כרטיסים, כל אחד מדגים מבנה אחר. כולם מנוהלים על ידי NAIMLY
 * ומסומנים ככרטיסי דוגמה — לא עסקים בדויים שמתחזים ללקוחות.
 */
const cards = [
  {
    ...base,
    slug: "noa-design",
    business_name: "NAIMLY",
    owner_name: "צוות נעימלי",
    role_title: "כרטיס ביקור דיגיטלי לעסקים",
    slogan: "כל מה שהלקוח צריך — בקישור אחד",
    bio: "כך נראה כרטיס NAIMLY אמיתי. כל פעולה כאן מובילה ליעד פעיל, וטופס הפנייה באמת שולח. אפשר לשלוח הודעה ולראות איך זה עובד מהצד של הלקוח.",
    cta_label: "דברו איתנו",
    primary_color: "#6d4aff",
    accent_color: "#14d9c4",
    button_color: "#6d4aff",
    template: "spotlight",
    background_preset: "aurora",
    seo_title: "NAIMLY — כרטיס ביקור דיגיטלי לדוגמה",
    seo_description: "דוגמה חיה לכרטיס ביקור דיגיטלי של NAIMLY: פעולות מהירות, מסלולים, טופס פניות ושמירת איש קשר.",
    services: planServices,
    business_hours: hours,
    contact_form_title: "נשמח לשמוע ממך",
    widgets: [
      { id: "w-services", type: "services", title: "המסלולים", enabled: true },
      { id: "w-hours", type: "hours", title: "שעות פעילות", enabled: true },
      { id: "w-contact", type: "contact_form", title: "נשמח לשמוע ממך", enabled: true },
    ],
  },
  {
    ...base,
    slug: "naimly-studio",
    business_name: "סטודיו לדוגמה",
    owner_name: "כרטיס דוגמה של NAIMLY",
    role_title: "מבנה לעסק ויזואלי",
    slogan: "כשהעבודה מדברת בעצמה",
    bio: "כרטיס דוגמה שמנוהל על ידי NAIMLY, ומדגים מבנה שמתאים לעסק שהתוצר שלו ויזואלי: גלריה בראש, שירותים מתחת, ופנייה בלחיצה אחת. הפרטים והפעולות מובילים ל-NAIMLY.",
    cta_label: "לפרטים",
    primary_color: "#c2410c",
    accent_color: "#f59e0b",
    button_color: "#c2410c",
    template: "bold",
    background_preset: "sunset",
    seo_title: "כרטיס דוגמה — מבנה לעסק ויזואלי | NAIMLY",
    seo_description: "כרטיס ביקור דיגיטלי לדוגמה עם גלריה, שירותים וטופס פניות. מנוהל על ידי NAIMLY.",
    services: [
      { id: "s-1", title: "פגישת היכרות", description: "שיחה קצרה להבנת הצורך ולבניית הצעה.", price: "ללא עלות" },
      { id: "s-2", title: "בניית הכרטיס", description: "מבנה, צבעים, תמונות ופעולות — מוכן לפרסום.", price: "לפי הצעה" },
    ],
    business_hours: hours,
    contact_form_title: "רוצים כרטיס כזה?",
    widgets: [
      { id: "w-gallery", type: "gallery", title: "גלריה", enabled: true },
      { id: "w-services", type: "services", title: "שירותים", enabled: true },
      { id: "w-contact", type: "contact_form", title: "רוצים כרטיס כזה?", enabled: true },
    ],
  },
  {
    ...base,
    slug: "naimly-consult",
    business_name: "ייעוץ לדוגמה",
    owner_name: "כרטיס דוגמה של NAIMLY",
    role_title: "מבנה לעסק שירותים",
    slogan: "מה מקבלים, כמה זה עולה, ומתי מתחילים",
    bio: "כרטיס דוגמה שמנוהל על ידי NAIMLY, ומדגים מבנה שמתאים לנותן שירות: שירותים ומחירים בראש, שעות פעילות, ופנייה ישירה. הפרטים והפעולות מובילים ל-NAIMLY.",
    cta_label: "קביעת שיחה",
    primary_color: "#0f766e",
    accent_color: "#22d3ee",
    button_color: "#0f766e",
    template: "clean",
    background_preset: "medical-mint",
    seo_title: "כרטיס דוגמה — מבנה לעסק שירותים | NAIMLY",
    seo_description: "כרטיס ביקור דיגיטלי לדוגמה עם שירותים, מחירים, שעות פעילות וטופס פניות. מנוהל על ידי NAIMLY.",
    services: [
      { id: "s-1", title: "שיחת אבחון", description: "שלושים דקות למיפוי המצב והגדרת יעד.", price: "ללא עלות" },
      { id: "s-2", title: "ליווי חודשי", description: "פגישה שבועית, יעדים מדידים ודוח התקדמות.", price: "לפי הצעה" },
    ],
    business_hours: hours,
    contact_form_title: "נקבע שיחה?",
    widgets: [
      { id: "w-services", type: "services", title: "השירותים", enabled: true },
      { id: "w-hours", type: "hours", title: "שעות פעילות", enabled: true },
      { id: "w-contact", type: "contact_form", title: "נקבע שיחה?", enabled: true },
    ],
  },
];

console.log(`\n=== ${cards.length} כרטיסי תצוגה · בעלים ${owner.email} ===\n`);
for (const card of cards) {
  const { data: existing } = await admin.from("cards").select("id").eq("slug", card.slug).maybeSingle();
  console.log(`  /${card.slug.padEnd(18)} ${existing ? "קיים — יעודכן" : "חדש — ייווצר"}`);
}

if (!apply) {
  console.log("\nלהחלה:  node --experimental-strip-types --import ./tests/alias-loader.mjs scripts/seed-showcase-cards.mjs --apply\n");
  process.exit(0);
}

let failures = 0;
for (const card of cards) {
  const { data: existing } = await admin.from("cards").select("id").eq("slug", card.slug).maybeSingle();

  const { data, error } = existing
    ? await admin.from("cards").update(card).eq("id", existing.id).select("id,slug").single()
    : await admin.from("cards").insert(card).select("id,slug").single();

  if (error || !data) {
    console.error(`\n❌ /${card.slug}: ${error?.message || "לא הוחזרה שורה"}`);
    failures += 1;
    continue;
  }

  // אימות: פנייה מהכרטיס חייבת להיקלט בפועל, אחרת הכרטיס אינו שימושי.
  const probe = await fetch(`${site}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: card.slug,
      name: "בדיקת זריעה",
      phone: "0500000000",
      email: "",
      message: "אימות אוטומטי שהכרטיס מקבל פניות.",
    }),
  });

  console.log(`  ✓ /${card.slug.padEnd(18)} ${data.id}  ליד: HTTP ${probe.status} ${probe.ok ? "✓" : "✗"}`);
  if (!probe.ok) failures += 1;
}

console.log(failures === 0 ? `\n✅ כל הכרטיסים נזרעו ומקבלים פניות.\n` : `\n❌ ${failures} כשלים.\n`);
process.exit(failures === 0 ? 0 : 1);
