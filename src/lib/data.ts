import { unstable_noStore as noStore } from "next/cache";
import { demoAnalytics, demoCard, demoViewer } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAccess } from "@/lib/plan-access";
import type { AnalyticsSummary, CardData, PlanId, Viewer } from "@/lib/types";

type SubscriptionRow = { status?: string | null; current_period_end?: string | null } | null | undefined;

/** מנוי פעיל, או התנסות שטרם הסתיימה. מרוכז כאן כדי שכל הנתיבים יסכימו. */
export function isSubscriptionLive(subscription: SubscriptionRow) {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  if (subscription.status !== "trialing") return false;
  return Boolean(subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now());
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function arrayValue<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function normalizeCard(row: Record<string, unknown>): CardData {
  return {
    id: stringValue(row.id, crypto.randomUUID()),
    userId: stringValue(row.user_id),
    slug: stringValue(row.slug, "my-card"),
    businessName: stringValue(row.business_name, "העסק שלי"),
    ownerName: stringValue(row.owner_name, "השם שלך"),
    roleTitle: stringValue(row.role_title, "המקצוע שלך"),
    slogan: stringValue(row.slogan),
    bio: stringValue(row.bio),
    ctaLabel: stringValue(row.cta_label, "בואו נדבר"),
    phone: stringValue(row.phone),
    whatsapp: stringValue(row.whatsapp),
    email: stringValue(row.email),
    website: stringValue(row.website),
    address: stringValue(row.address),
    avatarUrl: stringValue(row.avatar_url),
    coverUrl: stringValue(row.cover_url),
    logoUrl: stringValue(row.logo_url),
    logoShape: (["circle", "rounded", "square"].includes(stringValue(row.logo_shape)) ? stringValue(row.logo_shape) : "rounded") as CardData["logoShape"],
    videoUrl: stringValue(row.video_url),
    gallery: arrayValue(row.gallery, []),
    files: arrayValue(row.files, []),
    primaryColor: stringValue(row.primary_color, "#6d4aff"),
    accentColor: stringValue(row.accent_color, "#14d9c4"),
    buttonColor: stringValue(row.button_color, stringValue(row.primary_color, "#6d4aff")),
    headingColor: stringValue(row.heading_color, "#142038"),
    bodyTextColor: stringValue(row.body_text_color, "#53627a"),
    backgroundPreset: (["aurora", "midnight", "paper", "sunset", "ocean", "minimal"].includes(stringValue(row.background_preset)) ? stringValue(row.background_preset) : "aurora") as CardData["backgroundPreset"],
    template: (["spotlight", "clean", "bold"].includes(stringValue(row.template)) ? stringValue(row.template) : "spotlight") as CardData["template"],
    isPublished: Boolean(row.is_published),
    allowIndexing: row.allow_indexing !== false,
    seoTitle: stringValue(row.seo_title),
    seoDescription: stringValue(row.seo_description),
    socialImageUrl: stringValue(row.social_image_url),
    areaServed: stringValue(row.area_served),
    coverAlt: stringValue(row.cover_alt, "תמונת קאבר של העסק"),
    logoAlt: stringValue(row.logo_alt, "לוגו העסק"),
    avatarAlt: stringValue(row.avatar_alt, "תמונת פרופיל"),
    socialLinks: arrayValue(row.social_links, []),
    quickActions: arrayValue(row.quick_actions, []),
    quickActionsLimit: ([3, 6, 9].includes(Number(row.quick_actions_limit)) ? Number(row.quick_actions_limit) : 6) as CardData["quickActionsLimit"],
    smartButtons: arrayValue(row.smart_buttons, []),
    widgets: arrayValue(row.widgets, [
      { id: "services", type: "services", title: "השירותים שלי", enabled: true },
      { id: "gallery", type: "gallery", title: "גלריה", enabled: true },
      { id: "contact", type: "contact_form", title: "דברו איתי", enabled: true },
    ]),
    contactFormTitle: stringValue(row.contact_form_title, "רוצה שנחזור אליך?"),
    contactFormSuccessMessage: stringValue(row.contact_form_success_message, "תודה! הפרטים התקבלו."),
    contactFormFields: arrayValue(row.contact_form_fields, [
      { id: "name", label: "שם מלא", type: "text", required: true },
      { id: "phone", label: "טלפון", type: "tel", required: true },
      { id: "message", label: "במה אפשר לעזור?", type: "textarea", required: false },
    ]),
    galleryStyle: (stringValue(row.gallery_style) === "carousel" ? "carousel" : "grid") as CardData["galleryStyle"],
    tracking: (row.tracking && typeof row.tracking === "object" ? row.tracking : { googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "" }) as CardData["tracking"],
    vcard: (row.vcard && typeof row.vcard === "object" ? row.vcard : {
      fullName: stringValue(row.owner_name, "השם שלך"), organization: stringValue(row.business_name, "העסק שלי"), title: stringValue(row.role_title),
      phone: stringValue(row.phone), email: stringValue(row.email), website: stringValue(row.website), address: stringValue(row.address), note: "",
    }) as CardData["vcard"],
    services: arrayValue(row.services, []),
    testimonials: arrayValue(row.testimonials, []),
    businessHours: arrayValue(row.business_hours, []),
    updatedAt: stringValue(row.updated_at, new Date().toISOString()),
  };
}

/**
 * מצב הדגמה מחזיר Viewer מלא ללא התחברות. בפרודקשן הוא חייב הפעלה מפורשת,
 * אחרת פריסה עם משתני סביבה חסרים הופכת את כל האתר לפתוח.
 */
export const isDemoMode = !isSupabaseConfigured
  && (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE === "true");

export async function getViewer(): Promise<Viewer | null> {
  noStore();
  if (!isSupabaseConfigured) return isDemoMode ? demoViewer : null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("full_name,role,plan_id").eq("id", authData.user.id).maybeSingle(),
    supabase.from("subscriptions").select("status,plan_id,current_period_end,trial_ends_at").eq("user_id", authData.user.id).maybeSingle(),
  ]);

  // הסטטוס נשמר כפי שהוא. תפוגת ההתנסות נגזרת מ‑trialEndsAt דרך plan-access,
  // כדי שנוכל להבחין בין "ההתנסות נגמרה" לבין "המנוי בוטל".
  const subscriptionStatus = subscription?.status || "trialing";
  return {
    id: authData.user.id,
    email: authData.user.email || "",
    fullName: profile?.full_name || authData.user.user_metadata?.full_name || authData.user.email?.split("@")[0] || "משתמש",
    role: profile?.role === "admin" ? "admin" : "customer",
    plan: ((subscription?.plan_id || profile?.plan_id || "trial") as PlanId),
    subscriptionStatus,
    trialEndsAt: subscription?.trial_ends_at || subscription?.current_period_end || undefined,
    demo: false,
  };
}

export async function getDashboardCard(viewer: Viewer): Promise<CardData> {
  noStore();
  if (viewer.demo || !isSupabaseConfigured) return demoCard;
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("cards").select("*").eq("user_id", viewer.id).order("created_at").limit(1).maybeSingle()
    : { data: null };
  if (data) return normalizeCard(data);

  return starterCard(viewer);
}

/**
 * כרטיס פתיחה למשתמש חדש. הוא נגזר מכרטיס ההדגמה אבל מכווץ למגבלות המסלול,
 * אחרת השמירה הראשונה של משתמש בהתנסות הייתה נחסמת על ידי אכיפת המסלול.
 */
function starterCard(viewer: Viewer): CardData {
  const access = resolveAccess(viewer);
  const limits = access.limits;
  const features = access.features;
  const allowedWidget = (type: CardData["widgets"][number]["type"]) =>
    (type !== "video" || features.video) && (type !== "files" || features.files);

  return {
    ...demoCard,
    id: "",
    userId: viewer.id,
    slug: `card-${viewer.id.slice(0, 6)}`,
    businessName: "העסק שלי",
    ownerName: viewer.fullName || "השם שלך",
    email: viewer.email,
    services: [],
    testimonials: [],
    businessHours: [],
    files: [],
    gallery: [],
    isPublished: false,
    areaServed: features.seo ? demoCard.areaServed : "",
    socialImageUrl: features.seo ? demoCard.socialImageUrl : "",
    galleryStyle: features.carousel ? demoCard.galleryStyle : "grid",
    quickActionsLimit: Math.min(demoCard.quickActionsLimit, limits.quickActions) as CardData["quickActionsLimit"],
    quickActions: demoCard.quickActions.slice(0, limits.quickActions),
    widgets: demoCard.widgets.map((widget) => allowedWidget(widget.type) ? widget : { ...widget, enabled: false }),
    tracking: { googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "" },
  };
}

export async function getPublicCard(slug: string): Promise<CardData | null> {
  noStore();
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  if (!isSupabaseConfigured) return slug === demoCard.slug ? demoCard : null;
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data } = await admin.from("cards").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
    if (!data) return null;
    const { data: subscription } = await admin.from("subscriptions").select("status,current_period_end").eq("user_id", data.user_id).maybeSingle();
    if (!isSubscriptionLive(subscription)) return null;
    return normalizeCard(data);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("cards").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!data) return null;
  // אותה בדיקת מנוי כמו במסלול ה‑service-role, כדי שכרטיס של מנוי שפג לא יישאר חשוף.
  const { data: subscription } = await supabase.from("subscriptions").select("status,current_period_end").eq("user_id", data.user_id).maybeSingle();
  if (subscription && !isSubscriptionLive(subscription)) return null;
  return normalizeCard(data);
}

export async function getAnalyticsSummary(viewer: Viewer): Promise<AnalyticsSummary> {
  noStore();
  if (viewer.demo || !isSupabaseConfigured) return demoAnalytics;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return demoAnalytics;
  const { data: card } = await supabase.from("cards").select("id").eq("user_id", viewer.id).limit(1).maybeSingle();
  if (!card) return { views: 0, clicks: 0, leads: 0, contactSaves: 0, conversionRate: 0, daily: [], actions: [] };

  const analyticsDays = resolveAccess(viewer).limits.analyticsDays;
  const since = new Date(Date.now() - analyticsDays * 86400000).toISOString();
  const [{ data: events }, { count: leads }] = await Promise.all([
    supabase.from("card_events").select("event_type,created_at").eq("card_id", card.id).gte("created_at", since),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("card_id", card.id).gte("created_at", since),
  ]);
  const allEvents = events || [];
  const views = allEvents.filter((event) => event.event_type === "view" || event.event_type === "qr_scan").length;
  const contactSaves = allEvents.filter((event) => event.event_type === "contact_save").length;
  const actionMap = new Map<string, number>();
  allEvents.filter((event) => !["view", "qr_scan"].includes(event.event_type)).forEach((event) => actionMap.set(event.event_type, (actionMap.get(event.event_type) || 0) + 1));
  const clicks = [...actionMap.values()].reduce((sum, value) => sum + value, 0);
  const dailyMap = new Map<string, { views: number; clicks: number }>();
  allEvents.forEach((event) => {
    const key = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" }).format(new Date(event.created_at));
    const item = dailyMap.get(key) || { views: 0, clicks: 0 };
    if (event.event_type === "view" || event.event_type === "qr_scan") item.views += 1; else item.clicks += 1;
    dailyMap.set(key, item);
  });
  return {
    views,
    clicks,
    leads: leads || 0,
    contactSaves,
    conversionRate: views ? Number((((leads || 0) / views) * 100).toFixed(1)) : 0,
    daily: [...dailyMap.entries()].map(([date, value]) => ({ date, ...value })),
    actions: [...actionMap.entries()].map(([label, value]) => ({ label, value, percent: clicks ? Math.round((value / clicks) * 100) : 0 })).sort((a, b) => b.value - a.value),
  };
}

export type LeadRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
};

export async function getLeads(viewer: Viewer): Promise<LeadRecord[]> {
  noStore();
  if (viewer.demo || !isSupabaseConfigured) return [
    { id: "l1", name: "דנה לוי", phone: "052-111-2233", email: "dana@example.com", message: "אשמח לקבל הצעה לתהליך מיתוג לעסק חדש.", status: "new", createdAt: "2026-09-04T09:15:00.000Z" },
    { id: "l2", name: "רועי כהן", phone: "054-555-7788", email: "roy@example.com", message: "מעוניין בחבילת עיצוב לרשתות.", status: "contacted", createdAt: "2026-09-03T12:30:00.000Z" },
    { id: "l3", name: "שירה אדרי", phone: "050-222-9081", email: "", message: "אפשר לדבר לגבי לוגו ושפה חזותית?", status: "closed", createdAt: "2026-09-01T15:10:00.000Z" },
  ];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: cards } = await supabase.from("cards").select("id").eq("user_id", viewer.id);
  const cardIds = (cards || []).map((card) => card.id);
  if (!cardIds.length) return [];
  const { data } = await supabase.from("leads").select("id,name,phone,email,message,status,created_at").in("card_id", cardIds).order("created_at", { ascending: false }).limit(200);
  return (data || []).map((lead) => ({ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email || "", message: lead.message || "", status: lead.status, createdAt: lead.created_at }));
}

export type AdminSummary = {
  customers: number;
  activeCards: number;
  monthlyRevenue: number;
  leads: number;
  recentCustomers: Array<{ id: string; name: string; email: string; plan: PlanId; status: string; joinedAt: string }>;
};

export async function getAdminSummary(viewer: Viewer): Promise<AdminSummary | null> {
  noStore();
  if (viewer.role !== "admin") return null;
  if (viewer.demo) return {
    customers: 284,
    activeCards: 231,
    monthlyRevenue: 14320,
    leads: 1837,
    recentCustomers: [
      { id: "u1", name: "איתי ברק", email: "itay@example.com", plan: "pro", status: "active", joinedAt: "2026-09-04T08:10:00.000Z" },
      { id: "u2", name: "מאיה עזר", email: "maya@example.com", plan: "basic", status: "trialing", joinedAt: "2026-09-03T14:20:00.000Z" },
      { id: "u3", name: "רוני שלו", email: "roni@example.com", plan: "premium", status: "active", joinedAt: "2026-09-02T11:40:00.000Z" },
    ],
  };
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const [{ count: customers }, { count: activeCards }, { count: leads }, { data: subscriptions }, { data: profiles }] = await Promise.all([
    admin.from("profiles").select("id", { head: true, count: "exact" }),
    admin.from("cards").select("id", { head: true, count: "exact" }).eq("is_published", true),
    admin.from("leads").select("id", { head: true, count: "exact" }),
    admin.from("subscriptions").select("plan_id,status").in("status", ["active", "trialing"]),
    admin.from("profiles").select("id,full_name,email,plan_id,created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const prices: Record<string, number> = { trial: 0, basic: 39, pro: 69, premium: 119 };
  const monthlyRevenue = (subscriptions || []).filter((item) => item.status === "active").reduce((sum, item) => sum + (prices[item.plan_id] || 0), 0);
  return {
    customers: customers || 0,
    activeCards: activeCards || 0,
    monthlyRevenue,
    leads: leads || 0,
    recentCustomers: (profiles || []).map((profile) => ({ id: profile.id, name: profile.full_name || "ללא שם", email: profile.email || "", plan: (profile.plan_id || "trial") as PlanId, status: "active", joinedAt: profile.created_at })),
  };
}

export async function getPublishedSlugs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  noStore();
  if (!isSupabaseConfigured) return [{ slug: demoCard.slug, updatedAt: demoCard.updatedAt }];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const [{ data: cards }, { data: subscriptions }] = await Promise.all([
    admin.from("cards").select("slug,updated_at,user_id").eq("is_published", true).order("updated_at", { ascending: false }).limit(5000),
    admin.from("subscriptions").select("user_id,status,current_period_end").in("status", ["active", "trialing"]),
  ]);
  const eligible = new Set((subscriptions || []).filter(isSubscriptionLive).map((subscription) => subscription.user_id));
  return (cards || []).filter((card) => eligible.has(card.user_id)).map((card) => ({ slug: card.slug, updatedAt: card.updated_at }));
}
