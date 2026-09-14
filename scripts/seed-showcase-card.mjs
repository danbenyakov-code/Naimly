/**
 * זריעת כרטיס התצוגה `noa-design` כשורה אמיתית במסד.
 *
 * QA-013: /api/leads מחפש את הכרטיס לפי slug במסד. כרטיס ההדגמה הוגש
 * מהקוד בלבד ולכן לא נמצא, וכל פנייה ממנו נכשלה ב-404 — בדיוק ההתנהגות
 * שדווחה. אותו פער חל על אירועי צפייה ולחיצה, שנשמרים גם הם לפי card_id.
 *
 * QA-001: הפרטים הוחלפו ביעדים אמיתיים של NAIMLY. כרטיס תצוגה שמוביל
 * ל-example.com ול-tel:0500000000 מזיק יותר משאין כרטיס תצוגה.
 *
 * הבעלות היא של חשבון ההדגמה, ולכן פניות מגיעות לדשבורד שלו.
 *
 * שימוש:  node scripts/seed-showcase-card.mjs [--apply] [--owner=<email>] [--site=<url>]
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

const apply = process.argv.includes("--apply");
const OWNER_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "info.naimly@gmail.com";
const SLUG = "noa-design";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log(`\n=== כרטיס התצוגה /${SLUG} ===`);

/*
 * הבעלות היא של חשבון ההדגמה הייעודי ולא של חשבון האדמין. אדמין הוא
 * תפקיד תפעולי, ואין סיבה שכרטיס ציבורי, פניות של מבקרים והתראות
 * יהיו קשורים אליו.
 */
const ownerEmail = (process.argv.find((a) => a.startsWith("--owner=")) || "--owner=danbenyakov@gmail.com").slice(8);
const { data: owner } = await admin.from("profiles").select("id,email").eq("email", ownerEmail).maybeSingle();
if (!owner) {
  console.error(`
❌ לא נמצא חשבון ${ownerEmail} שיחזיק את כרטיס התצוגה.
`);
  process.exit(1);
}
console.log(`  בעלים: ${owner.email}`);

const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || OWNER_EMAIL;
const whatsapp = process.env.NEXT_PUBLIC_BILLING_WHATSAPP || "972552951664";
// כתובת האימות נמסרת בשורת הפקודה; NEXT_PUBLIC_SITE_URL מקומי מצביע ל-localhost.
const siteArg = process.argv.find((a) => a.startsWith("--site="));
const site = siteArg ? siteArg.slice(7) : "https://naimly-mu.vercel.app";

const card = {
  user_id: owner.id,
  slug: SLUG,
  business_name: "NAIMLY",
  owner_name: "צוות נעימלי",
  role_title: "כרטיס ביקור דיגיטלי לעסקים",
  slogan: "כל מה שהלקוח צריך — בקישור אחד",
  bio: "כך נראה כרטיס NAIMLY אמיתי. כל פעולה כאן מובילה ליעד פעיל, וטופס הפנייה באמת שולח. אפשר לשלוח הודעה ולראות איך זה עובד מהצד של הלקוח.",
  cta_label: "דברו איתנו",
  phone: "055-295-1664",
  whatsapp,
  email: support,
  website: site,
  primary_color: "#6d4aff",
  accent_color: "#14d9c4",
  button_color: "#6d4aff",
  template: "spotlight",
  background_preset: "aurora",
  gallery_style: "grid",
  is_published: true,
  allow_indexing: true,
  seo_title: "NAIMLY — כרטיס ביקור דיגיטלי לדוגמה",
  seo_description: "דוגמה חיה לכרטיס ביקור דיגיטלי של NAIMLY: פעולות מהירות, שירותים, טופס פניות ושמירת איש קשר.",
  area_served: "ישראל",
  quick_actions: [
    { id: "qa-phone", type: "phone", label: "שיחה", icon: "phone", value: "" },
    { id: "qa-whatsapp", type: "whatsapp", label: "וואטסאפ", icon: "message-circle", value: "" },
    { id: "qa-email", type: "email", label: "אימייל", icon: "mail", value: "" },
    { id: "qa-site", type: "website", label: "לאתר", icon: "link", value: "" },
    { id: "qa-save", type: "save_contact", label: "שמירת איש קשר", icon: "user-plus", value: "" },
  ],
  quick_actions_limit: 9,
  services: [
    { id: "s-basic", title: "בסיסי", description: "כרטיס דיגיטלי מלא, 3 פעולות מהירות וטופס פניות.", price: "29 ₪ לחודש" },
    { id: "s-pro", title: "מקצועי", description: "6 פעולות, גלריה מורחבת, מדידה ו-SEO מתקדם.", price: "49 ₪ לחודש" },
    { id: "s-premium", title: "פרימיום", description: "9 פעולות, קבצים להורדה, ייצוא לידים ותמיכה מועדפת.", price: "119 ₪ לחודש" },
  ],
  testimonials: [],
  business_hours: [
    { day: "ראשון–חמישי", hours: "09:00–18:00" },
    { day: "שישי", hours: "09:00–13:00" },
    { day: "שבת", hours: "סגור" },
  ],
  social_links: [],
  widgets: [
    { id: "w-services", type: "services", title: "המסלולים", enabled: true },
    { id: "w-hours", type: "hours", title: "שעות פעילות", enabled: true },
    { id: "w-contact", type: "contact_form", title: "נשמח לשמוע ממך", enabled: true },
  ],
  contact_form_title: "נשמח לשמוע ממך",
  contact_form_success_message: "קיבלנו את הפנייה ונחזור אליך בהקדם.",
  // ה-vCard נגזר מהכרטיס דרך resolveVCard, ולכן נשאר ריק בכוונה.
  vcard: {
    fullName: "", firstName: "", lastName: "", organization: "", title: "",
    phone: "", phoneSecondary: "", email: "", website: "", address: "", note: "",
    includePhoto: false,
  },
};

const { data: existing } = await admin.from("cards").select("id,user_id,is_published").eq("slug", SLUG).maybeSingle();
console.log(existing ? `  קיים במסד: ${existing.id}` : "  אינו קיים במסד — זו סיבת השורש של QA-013");

if (!apply) {
  console.log(`\n${existing ? "יעודכן" : "ייווצר"}. להחלה:  node scripts/seed-showcase-card.mjs --apply\n`);
  process.exit(0);
}

const { data, error } = existing
  ? await admin.from("cards").update(card).eq("id", existing.id).select("id,slug").single()
  : await admin.from("cards").insert(card).select("id,slug").single();

if (error) {
  console.error(`\n❌ ${error.message}\n`);
  process.exit(1);
}

// אימות: פנייה מהכרטיס חייבת להיקלט בפועל.
const probe = await fetch(`${site}/api/leads`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ slug: SLUG, name: "בדיקת זריעה", phone: "0500000000", email: "", message: "אימות אוטומטי שהכרטיס מקבל פניות." }),
});

console.log(`\n✅ נכתב: ${data.id}`);
console.log(`   שליחת ליד מהכרטיס: HTTP ${probe.status} ${probe.ok ? "✓" : "✗"}`);
console.log(`   ${site}/${SLUG}\n`);
process.exit(probe.ok ? 0 : 1);
