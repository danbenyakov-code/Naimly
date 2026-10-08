/**
 * בקרת משתמשים: חישוב שלב במשפך, מצב מסלול ומדדי סיכום.
 *
 * הכל כאן פונקציות טהורות מעל שורה אחת של admin_users_overview (מיגרציה
 * 033), כדי שאפשר יהיה לבדוק את הלוגיקה בלי מסד.
 */

export type UserOverviewRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_by_admin: boolean | null;
  profile_phone: string | null;
  signed_up_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  plan_selected_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  admin_locked: boolean | null;
  card_count: number | null;
  published_count: number | null;
  primary_card_slug: string | null;
  primary_business_name: string | null;
  primary_card_published: boolean | null;
  card_phone: string | null;
  card_whatsapp: string | null;
  payment_phone: string | null;
  open_payment_status: string | null;
  first_payment_at: string | null;
  views: number | string | null;
  clicks: number | string | null;
  leads: number | string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
  last_app_visit_at: string | null;
  /** מקור ההרשמה (utm), אם נקלט. card_badge = תג "נבנה ב־NAIMLY" בכרטיס. */
  signup_source?: string | null;
  signup_medium?: string | null;
  signup_campaign?: string | null;
  /** חשבון בדיקה פנימי: מוצג עם סימון, ואינו נספר בסיכומים. */
  is_test_account?: boolean | null;
};

/** תיאור קריא של מקור ההרשמה. */
export function signupSourceLabel(source: string | null | undefined, campaign?: string | null) {
  if (!source) return "";
  if (source === "card_badge") return campaign ? `תג בכרטיס /${campaign}` : "תג בכרטיס";
  if (source === "email") return "מייל";
  return campaign ? `${source} (${campaign})` : source;
}

// ─────────────────────────────────────────────────────────────────────────────
// שלבי המשפך, לפי הסדר
// ─────────────────────────────────────────────────────────────────────────────

export const funnelStages = [
  { id: "registered", label: "נרשם, לא אימת מייל", tone: "slate" },
  { id: "verified", label: "אימת מייל, לא בחר מסלול", tone: "slate" },
  { id: "plan_selected", label: "בחר מסלול, אין כרטיס", tone: "amber" },
  { id: "card_draft", label: "יצר כרטיס, לא פרסם", tone: "amber" },
  { id: "published", label: "פרסם, אין צפיות", tone: "sky" },
  { id: "viewed", label: "יש צפיות, אין פניות", tone: "sky" },
  { id: "lead", label: "קיבל פנייה", tone: "violet" },
  { id: "payment_requested", label: "ביקש תשלום", tone: "violet" },
  { id: "paying", label: "משלם", tone: "green" },
  { id: "expired", label: "הסתיים בלי תשלום", tone: "red" },
] as const;

export type FunnelStage = (typeof funnelStages)[number]["id"];
export type StageTone = (typeof funnelStages)[number]["tone"];

export const funnelStageLabel = Object.fromEntries(funnelStages.map((stage) => [stage.id, stage.label])) as Record<FunnelStage, string>;
export const funnelStageTone = Object.fromEntries(funnelStages.map((stage) => [stage.id, stage.tone])) as Record<FunnelStage, StageTone>;

// ─────────────────────────────────────────────────────────────────────────────
// מצב המסלול
// ─────────────────────────────────────────────────────────────────────────────

export type PlanState = "not_selected" | "pending_payment" | "trial" | "paying" | "expired" | "locked";

export const planStateLabel: Record<PlanState, string> = {
  not_selected: "לא בחר מסלול",
  pending_payment: "ממתין לתשלום",
  trial: "ניסיון",
  paying: "משלם",
  expired: "פג תוקף",
  locked: "נעול",
};

const planNames: Record<string, string> = { trial: "ניסיון", basic: "בסיסי", pro: "מקצועי", premium: "פרימיום" };

export function planLabel(planId: string | null | undefined) {
  return planNames[planId || ""] || "ללא";
}

const DAY = 86400000;

function time(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/** אותה הגדרה כמו effective_plan במסד (מיגרציה 030). */
export function planState(row: UserOverviewRow, now = Date.now()): PlanState {
  if (row.admin_locked) return "locked";
  if (!row.plan_selected_at) return "not_selected";
  const periodEnd = time(row.current_period_end);
  if (row.subscription_status === "active") return periodEnd === null || periodEnd > now ? "paying" : "expired";
  if (row.subscription_status === "trialing") {
    /*
     * בחר מסלול בתשלום ולא התחיל התנסות: הסטטוס נשאר trialing עד אישור
     * התשלום, אבל זה לא ניסיון. בלי ההבחנה הוא היה נספר כ"בניסיון פעיל".
     */
    if (!row.trial_started_at) return "pending_payment";
    const trialEnd = time(row.trial_ends_at) ?? periodEnd;
    return trialEnd !== null && trialEnd > now ? "trial" : "expired";
  }
  return "expired";
}

/** ימים שנותרו להתנסות פעילה, מעוגל למעלה. null = אין התנסות פעילה. */
export function trialDaysLeft(row: UserOverviewRow, now = Date.now()) {
  if (planState(row, now) !== "trial") return null;
  const end = time(row.trial_ends_at) ?? time(row.current_period_end);
  if (end === null) return null;
  return Math.max(0, Math.ceil((end - now) / DAY));
}

// ─────────────────────────────────────────────────────────────────────────────
// השלב במשפך: השלב הגבוה ביותר שהמשתמש הגיע אליו
// ─────────────────────────────────────────────────────────────────────────────

export function funnelStage(row: UserOverviewRow, now = Date.now()): FunnelStage {
  const state = planState(row, now);
  if (state === "paying") return "paying";
  if (row.open_payment_status) return "payment_requested";
  if (state === "expired" || state === "locked") return "expired";
  if (!row.email_confirmed_at) return "registered";
  if (!row.plan_selected_at) return "verified";
  if (toNumber(row.card_count) === 0) return "plan_selected";
  if (toNumber(row.published_count) === 0) return "card_draft";
  if (toNumber(row.views) === 0) return "published";
  if (toNumber(row.leads) === 0) return "viewed";
  return "lead";
}

// ─────────────────────────────────────────────────────────────────────────────
// טלפון לפנייה: לרוב הלקוחות הוותיקים אין טלפון בפרופיל
// ─────────────────────────────────────────────────────────────────────────────

export type PhoneSource = "profile" | "card_whatsapp" | "card_phone" | "payment";

export const phoneSourceLabel: Record<PhoneSource, string> = {
  profile: "מהפרופיל",
  card_whatsapp: "וואטסאפ מהכרטיס",
  card_phone: "טלפון מהכרטיס",
  payment: "מבקשת תשלום",
};

export function contactPhone(row: UserOverviewRow): { phone: string; source: PhoneSource } | null {
  const candidates: Array<[string | null, PhoneSource]> = [
    [row.profile_phone, "profile"],
    [row.card_whatsapp, "card_whatsapp"],
    [row.card_phone, "card_phone"],
    [row.payment_phone, "payment"],
  ];
  for (const [value, source] of candidates) {
    const phone = String(value || "").trim();
    if (phone.replace(/\D/g, "").length >= 9) return { phone, source };
  }
  return null;
}

/** קישור wa.me. מספר ישראלי מקומי (05x) מומר לקידומת 972. */
export function whatsappLink(phone: string, message?: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// שורה מוכנה לתצוגה: מחושבת פעם אחת בשרת, עם אותו "עכשיו" לכל השורות
// ─────────────────────────────────────────────────────────────────────────────

export type ControlUser = {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  phoneSource: PhoneSource | null;
  isAdmin: boolean;
  isTest: boolean;
  signedUpAt: string;
  /** הכניסה האחרונה: התחברות או חזרה למערכת כשכבר מחובר, המאוחר מביניהם. */
  lastSeenAt: string | null;
  emailVerified: boolean;
  plan: string;
  planState: PlanState;
  trialDaysLeft: number | null;
  cardCount: number;
  published: boolean;
  cardSlug: string | null;
  views: number;
  clicks: number;
  leads: number;
  stage: FunnelStage;
  lastActivityType: string | null;
  lastActivityAt: string | null;
  signupSource: string;
};

function latest(...values: Array<string | null | undefined>) {
  let best: string | null = null;
  for (const value of values) {
    const ms = time(value);
    if (ms !== null && (best === null || ms > (time(best) ?? 0))) best = value!;
  }
  return best;
}

export function toControlUser(row: UserOverviewRow, now = Date.now()): ControlUser {
  const phone = contactPhone(row);
  const state = planState(row, now);
  return {
    id: row.user_id,
    name: (row.full_name || "").trim() || "ללא שם",
    businessName: (row.primary_business_name || "").trim(),
    email: row.email || "",
    phone: phone?.phone || "",
    phoneSource: phone?.source || null,
    isAdmin: row.role === "admin",
    isTest: row.is_test_account === true,
    signedUpAt: row.signed_up_at,
    lastSeenAt: latest(row.last_sign_in_at, row.last_app_visit_at),
    emailVerified: Boolean(row.email_confirmed_at),
    plan: state === "trial" ? "ניסיון" : planLabel(row.plan_id),
    planState: state,
    trialDaysLeft: trialDaysLeft(row, now),
    cardCount: toNumber(row.card_count),
    published: toNumber(row.published_count) > 0,
    cardSlug: row.primary_card_slug,
    views: toNumber(row.views),
    clicks: toNumber(row.clicks),
    leads: toNumber(row.leads),
    stage: funnelStage(row, now),
    lastActivityType: row.last_activity_type,
    lastActivityAt: row.last_activity_at,
    signupSource: signupSourceLabel(row.signup_source, row.signup_campaign),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// מדדי סיכום
// ─────────────────────────────────────────────────────────────────────────────

export type ControlSummary = {
  total: number;
  signedUpThisWeek: number;
  activeTrials: number;
  trialsEndingSoon: number;
  paying: number;
  published: number;
  signupToPublishedPercent: number;
  trialsFinished: number;
  trialsConverted: number;
  trialToPaidPercent: number;
  /** הרשמות שהגיעו מלחיצה על תג "נבנה ב־NAIMLY" בכרטיס של לקוח. */
  signupsFromBadge: number;
};

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/**
 * מנהלים וחשבונות בדיקה לא נספרים: הם ינפחו כל מדד.
 *
 * המרה מניסיון לתשלום נמדדת רק על ניסיונות שהוכרעו: הסתיימו, או ששילמו
 * לפני הסוף. ניסיון שעדיין רץ אינו כישלון ואינו הצלחה.
 */
export function controlSummary(rows: UserOverviewRow[], now = Date.now()): ControlSummary {
  const customers = rows.filter((row) => row.role !== "admin" && row.is_test_account !== true);
  const weekAgo = now - 7 * DAY;

  let signedUpThisWeek = 0;
  let activeTrials = 0;
  let trialsEndingSoon = 0;
  let paying = 0;
  let published = 0;
  let trialsFinished = 0;
  let trialsConverted = 0;
  let signupsFromBadge = 0;

  for (const row of customers) {
    const state = planState(row, now);
    const signedUp = time(row.signed_up_at);
    if (signedUp !== null && signedUp >= weekAgo) signedUpThisWeek += 1;
    if (state === "trial") {
      activeTrials += 1;
      const left = trialDaysLeft(row, now);
      if (left !== null && left <= 3) trialsEndingSoon += 1;
    }
    if (state === "paying") paying += 1;
    if (toNumber(row.published_count) > 0) published += 1;
    if (row.signup_source === "card_badge") signupsFromBadge += 1;

    if (row.trial_started_at) {
      const paid = Boolean(row.first_payment_at);
      const ended = (time(row.trial_ends_at) ?? Infinity) <= now;
      if (paid || ended) {
        trialsFinished += 1;
        if (paid) trialsConverted += 1;
      }
    }
  }

  return {
    total: customers.length,
    signedUpThisWeek,
    activeTrials,
    trialsEndingSoon,
    paying,
    published,
    signupToPublishedPercent: percent(published, customers.length),
    trialsFinished,
    trialsConverted,
    trialToPaidPercent: percent(trialsConverted, trialsFinished),
    signupsFromBadge,
  };
}

/** שורות התצוגה והסיכום, מחושבים מול אותו רגע. */
export function buildControlView(rows: UserOverviewRow[], now = Date.now()) {
  return { users: rows.map((row) => toControlUser(row, now)), summary: controlSummary(rows, now) };
}

// ─────────────────────────────────────────────────────────────────────────────
// תאריכים: תמיד בשעון ישראל, גם כשהשרת רץ ב-UTC
// ─────────────────────────────────────────────────────────────────────────────

const dateTimeFormat = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit" });

export function formatDateTime(value: string | null | undefined) {
  const ms = time(value);
  return ms === null ? "" : dateTimeFormat.format(ms);
}

export function formatDate(value: string | null | undefined) {
  const ms = time(value);
  return ms === null ? "" : dateFormat.format(ms);
}

// ─────────────────────────────────────────────────────────────────────────────
// תוויות לאירועים
// ─────────────────────────────────────────────────────────────────────────────

export const eventLabels: Record<string, string> = {
  signed_up: "נרשם",
  email_verified: "אימת מייל",
  logged_in: "התחבר",
  app_visit: "נכנס למערכת",
  plan_selected: "בחר מסלול",
  card_created: "יצר כרטיס",
  card_first_edit: "ערך את הכרטיס לראשונה",
  card_published: "פרסם כרטיס",
  card_unpublished: "הסיר כרטיס מהאוויר",
  card_deleted: "מחק כרטיס",
  card_first_view: "צפייה ראשונה בכרטיס",
  first_lead_received: "קיבל פנייה ראשונה",
  payment_requested: "ביקש לשלם",
  payment_completed: "תשלום הושלם",
  subscription_activated: "המנוי הופעל",
  trial_expired: "הניסיון הסתיים",
  subscription_expired: "המנוי פג",
  email_sent: "נשלח מייל",
  unsubscribed: "הסיר עצמו מדיוור",
};

export const emailLabels: Record<string, string> = {
  verification_code: "קוד אימות",
  password_reset: "איפוס סיסמה",
  lead_notification: "התראה על פנייה",
  renewal_reminder: "תזכורת חידוש",
  purchase_request_received: "אישור קבלת הזמנה",
  payment_link: "קישור תשלום",
  plan_activated: "הפעלת מסלול",
  legal_acceptance: "אישור תנאים",
  trial_ending_3d: "תזכורת: 3 ימים לסוף הניסיון",
  trial_ending_1d: "תזכורת: יום לסוף הניסיון",
  trial_ended: "הניסיון הסתיים",
  weekly_report: "דוח שבועי",
  weekly_tips: "טיפים להפצה (דוח שבועי)",
};

export function eventLabel(type: string | null | undefined) {
  return eventLabels[type || ""] || type || "";
}

/** פרט קצר שמוצג ליד האירוע בציר הזמן. */
export function eventDetail(type: string, metadata: Record<string, unknown> | null | undefined) {
  const data = metadata || {};
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  switch (type) {
    case "email_sent":
      return emailLabels[text("email")] || text("email");
    case "signed_up": {
      const attribution = (data.attribution || {}) as Record<string, unknown>;
      const source = typeof attribution.source === "string" ? attribution.source : "";
      return source ? `מקור: ${signupSourceLabel(source, typeof attribution.campaign === "string" ? attribution.campaign : "")}` : "";
    }
    case "plan_selected": {
      const choice = text("choice");
      if (choice === "trial") return "ניסיון 14 יום";
      if (choice === "admin") return `נפתח על ידי מנהל, ${planLabel(text("plan"))}`;
      return "מסלול בתשלום";
    }
    case "payment_requested":
    case "payment_completed": {
      const plan = text("plan") === "extra_card" ? "כרטיס נוסף" : planLabel(text("plan"));
      const cycle = text("cycle") === "annual" ? "שנתי" : "חודשי";
      return `${plan}, ${cycle}`;
    }
    case "subscription_activated": {
      const renewal = data.renewal === true ? "חידוש, " : "";
      return `${renewal}${planLabel(text("plan"))}`;
    }
    case "card_first_view":
      return text("source") === "qr_scan" ? "מסריקת QR" : text("slug");
    case "card_created":
    case "card_first_edit":
    case "card_published":
    case "card_unpublished":
    case "card_deleted":
      return text("slug");
    default:
      return "";
  }
}
