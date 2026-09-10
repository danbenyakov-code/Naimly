import { plans } from "@/lib/config";
import type { CardData, PlanId, Viewer } from "@/lib/types";

/** אורך תקופת ההתנסות בימים. חייב להישאר תואם למיגרציה של Supabase. */
export const TRIAL_DAYS = 14;

export type FeatureKey =
  | "tracking"
  | "leadExport"
  | "carousel"
  | "video"
  | "files"
  | "testimonials"
  | "smartButtons"
  | "seo"
  | "prioritySupport";

export type FeatureMap = Record<FeatureKey, boolean>;
export type Limits = { cards: number; galleryItems: number; analyticsDays: number; quickActions: 3 | 6 | 9; tracking: boolean };

const allFeatures: FeatureMap = {
  tracking: true, leadExport: true, carousel: true, video: true, files: true,
  testimonials: true, smartButtons: true, seo: true, prioritySupport: true,
};

/**
 * מה כל מסלול בתשלום פותח. זהו המקור היחיד — השרת, ה‑DB וה‑UI נגזרים ממנו.
 * ההתנסות אינה מופיעה כאן בכוונה: היא מקבלת גישה מלאה (ראו trialFeatures).
 */
const featuresByPlan: Record<Exclude<PlanId, "trial">, FeatureMap> = {
  basic: { tracking: false, leadExport: false, carousel: false, video: true, files: false, testimonials: true, smartButtons: true, seo: false, prioritySupport: false },
  pro: { tracking: true, leadExport: false, carousel: true, video: true, files: true, testimonials: true, smartButtons: true, seo: true, prioritySupport: false },
  premium: { ...allFeatures },
};

/** ההתנסות פותחת את כל היכולות, כדי שהלקוח יתנסה במוצר המלא. */
export const trialFeatures: FeatureMap = { ...allFeatures };
/** ומקבלת את המכסות של המסלול הגבוה ביותר. */
export const trialLimits: Limits = plans.find((plan) => plan.id === "premium")!.limits;

export const featureLabels: Record<FeatureKey, string> = {
  tracking: "Meta Pixel ו‑Google Analytics",
  leadExport: "ייצוא לידים ל‑CSV",
  carousel: "גלריית קרוסלה",
  video: "וידג׳ט סרטון",
  files: "קבצים להורדה",
  testimonials: "המלצות לקוחות",
  smartButtons: "כפתורים חכמים",
  seo: "SEO מתקדם — אזור שירות ותמונת שיתוף",
  prioritySupport: "תמיכה מועדפת",
};

/** מסלולים בתשלום בלבד, מהזול ליקר. */
export const paidPlanOrder: Array<Exclude<PlanId, "trial">> = ["basic", "pro", "premium"];
const planOrder: PlanId[] = ["trial", "basic", "pro", "premium"];

export function planFeatures(planId: PlanId): FeatureMap {
  return planId === "trial" ? trialFeatures : featuresByPlan[planId] || featuresByPlan.basic;
}

export function planLimits(planId: PlanId): Limits {
  if (planId === "trial") return trialLimits;
  return (plans.find((plan) => plan.id === planId) || plans[0]).limits;
}

export function planName(planId: PlanId) {
  return (plans.find((plan) => plan.id === planId) || plans[0]).name;
}

/** המסלול בתשלום הזול ביותר שפותח את היכולת. */
export function requiredPlanForFeature(feature: FeatureKey): PlanId {
  return paidPlanOrder.find((planId) => featuresByPlan[planId][feature]) || "premium";
}

/** המסלול בתשלום הזול ביותר שמאפשר לפחות את הכמות המבוקשת. */
export function requiredPlanForLimit(limit: "galleryItems" | "quickActions" | "analyticsDays" | "cards", amount: number): PlanId {
  return paidPlanOrder.find((planId) => planLimits(planId)[limit] >= amount) || "premium";
}

export function isUpgrade(from: PlanId, to: PlanId) {
  return planOrder.indexOf(to) > planOrder.indexOf(from);
}

export type TrialState = {
  /** ההתנסות פעילה כרגע. */
  active: boolean;
  /** נרשם אך טרם בחר מסלול — אין גישה עד לבחירה בשער ההצטרפות. */
  pending: boolean;
  /** ההתנסות הסתיימה ולא נרכש מסלול — המערכת נעולה. */
  expired: boolean;
  endsAt: string | null;
  daysLeft: number;
  hoursLeft: number;
  totalDays: number;
  /** כמה מהתקופה נוצל, 0–100. */
  percentUsed: number;
};

const emptyTrial: TrialState = { active: false, pending: false, expired: false, endsAt: null, daysLeft: 0, hoursLeft: 0, totalDays: TRIAL_DAYS, percentUsed: 0 };

export function trialState(viewer: Pick<Viewer, "subscriptionStatus" | "trialEndsAt" | "trialPending" | "planSelectedAt">, now = Date.now()): TrialState {
  if (viewer.subscriptionStatus === "active") return emptyTrial;

  /*
   * טרם נבחר מסלול. ההתנסות אינה פעילה ואין גישה — בדיוק כמו
   * effective_plan במסד, שמחזיר 'none' כל עוד plan_selected_at ריק.
   * חשוב שהממשק לא ירשה את מה שהמסד חוסם.
   */
  if (!viewer.planSelectedAt && viewer.subscriptionStatus === "trialing") {
    return { ...emptyTrial, pending: true };
  }

  const endsAt = viewer.trialEndsAt ? new Date(viewer.trialEndsAt).getTime() : NaN;
  if (!Number.isFinite(endsAt)) {
    return viewer.subscriptionStatus === "trialing"
      ? { ...emptyTrial, active: true, daysLeft: TRIAL_DAYS, hoursLeft: TRIAL_DAYS * 24 }
      : emptyTrial;
  }

  const msLeft = endsAt - now;
  if (msLeft <= 0) return { ...emptyTrial, expired: true, endsAt: new Date(endsAt).toISOString(), percentUsed: 100 };
  if (viewer.subscriptionStatus !== "trialing") return emptyTrial;

  const totalMs = TRIAL_DAYS * 86400000;
  return {
    active: true,
    pending: false,
    expired: false,
    endsAt: new Date(endsAt).toISOString(),
    daysLeft: Math.ceil(msLeft / 86400000),
    hoursLeft: Math.ceil(msLeft / 3600000),
    totalDays: TRIAL_DAYS,
    percentUsed: Math.min(100, Math.max(0, Math.round(((totalMs - msLeft) / totalMs) * 100))),
  };
}

export type AccessReason = "active" | "trial" | "trial_expired" | "payment_pending" | "inactive" | "plan_not_selected";

export type Access = {
  /** המסלול שקובע יכולות בפועל. */
  plan: PlanId;
  features: FeatureMap;
  limits: Limits;
  /** true = לא שילם. הכל חסום: עריכה, העלאה, פרסום, והכרטיס הציבורי מושהה. */
  locked: boolean;
  trial: TrialState;
  reason: AccessReason;
};

const lockedFeatures: FeatureMap = {
  tracking: false, leadExport: false, carousel: false, video: false, files: false,
  testimonials: false, smartButtons: false, seo: false, prioritySupport: false,
};

/**
 * נקודת הכניסה היחידה להרשאות. כל מסך וכל route נגזרים מכאן, כדי שלא ייווצר
 * מצב שבו הממשק מרשה משהו שהשרת חוסם (או להפך).
 */
export function resolveAccess(viewer: Pick<Viewer, "plan" | "subscriptionStatus" | "trialEndsAt" | "trialPending" | "planSelectedAt">, now = Date.now()): Access {
  const trial = trialState(viewer, now);

  if (viewer.subscriptionStatus === "active") {
    const plan = viewer.plan === "trial" ? "basic" : viewer.plan;
    return { plan, features: planFeatures(plan), limits: planLimits(plan), locked: false, trial, reason: "active" };
  }

  if (trial.active) {
    // התנסות: גישה מלאה לכל היכולות, במכסות של פרימיום.
    return { plan: "trial", features: trialFeatures, limits: trialLimits, locked: false, trial, reason: "trial" };
  }

  const reason: AccessReason = trial.pending
    ? "plan_not_selected"
    : trial.expired
    ? "trial_expired"
    : viewer.subscriptionStatus === "past_due"
      ? "payment_pending"
      : "inactive";

  return { plan: viewer.plan, features: lockedFeatures, limits: planLimits(viewer.plan), locked: true, trial, reason };
}

/** האם מותר לשמור, להעלות ולפרסם כרגע. */
export function canEdit(viewer: Pick<Viewer, "plan" | "subscriptionStatus" | "trialEndsAt" | "trialPending" | "planSelectedAt">) {
  return !resolveAccess(viewer).locked;
}

export const lockMessages: Record<AccessReason, string> = {
  active: "",
  trial: "",
  trial_expired: `תקופת ההתנסות בת ${TRIAL_DAYS} הימים הסתיימה. הכרטיס הציבורי הושהה והעריכה נעולה עד לבחירת מסלול.`,
  payment_pending: "התשלום טרם אושר. ברגע שנאשר את ההעברה בביט המערכת תיפתח מחדש.",
  inactive: "המנוי אינו פעיל. יש לבחור מסלול כדי להמשיך לערוך ולפרסם.",
  plan_not_selected: "עדיין לא נבחר מסלול. בחירת מסלול פותחת את המערכת ומתחילה את הספירה.",
};

// ─────────────────────────────────────────────────────────────────────────────
// השפעת מעבר למסלול נמוך יותר
// ─────────────────────────────────────────────────────────────────────────────

export type ImpactItem = {
  key: string;
  /** מה קורה בפועל. */
  label: string;
  /** "removed" = תוכן יימחק מהכרטיס. "disabled" = היכולת תיסגר. */
  kind: "removed" | "disabled";
  /** כמות פריטים שתיחתך, כשרלוונטי. */
  count?: number;
};

/**
 * מה בדיוק יאבד ללקוח אם יעבור למסלול נתון, לפי התוכן שבנה בפועל.
 * משמש גם בהתנסות ("כך ייראה הכרטיס אחרי הבחירה") וגם בשדרוג/שנמוך.
 */
export function downgradeImpact(card: CardData, targetPlan: PlanId): ImpactItem[] {
  const limits = planLimits(targetPlan);
  const features = planFeatures(targetPlan);
  const items: ImpactItem[] = [];

  const galleryOverflow = Math.max(0, card.gallery.length - limits.galleryItems);
  if (galleryOverflow > 0) {
    items.push({ key: "gallery", kind: "removed", count: galleryOverflow, label: `${galleryOverflow} תמונות בגלריה יימחקו (נשארות ${limits.galleryItems})` });
  }

  const actionsOverflow = Math.max(0, card.quickActions.length - limits.quickActions);
  if (actionsOverflow > 0) {
    items.push({ key: "quickActions", kind: "removed", count: actionsOverflow, label: `${actionsOverflow} פעולות מהירות יוסרו (נשארות ${limits.quickActions})` });
  }

  if (!features.tracking && Object.values(card.tracking).some(Boolean)) {
    items.push({ key: "tracking", kind: "disabled", label: "חיבורי Meta Pixel ו‑Google Analytics ינותקו" });
  }

  if (!features.carousel && card.galleryStyle === "carousel") {
    items.push({ key: "carousel", kind: "disabled", label: "הגלריה תחזור לתצוגת רשת במקום קרוסלה" });
  }

  const enabled = new Set(card.widgets.filter((widget) => widget.enabled).map((widget) => widget.type));
  if (!features.video && enabled.has("video")) {
    items.push({ key: "video", kind: "disabled", label: "וידג׳ט הסרטון ייכבה" });
  }
  if (!features.files && (enabled.has("files") || card.files.length > 0)) {
    items.push({ key: "files", kind: "removed", count: card.files.length, label: card.files.length ? `${card.files.length} קבצים להורדה יוסרו מהכרטיס` : "וידג׳ט הקבצים ייכבה" });
  }
  if (!features.seo && (card.areaServed || card.socialImageUrl)) {
    items.push({ key: "seo", kind: "removed", label: "אזור השירות ותמונת השיתוף המותאמת יימחקו" });
  }
  if (!features.leadExport) {
    items.push({ key: "leadExport", kind: "disabled", label: "ייצוא הלידים ל‑CSV ייסגר (הלידים עצמם נשמרים)" });
  }

  return items;
}

/**
 * גוזם כרטיס למגבלות של מסלול. משמש בשרת בעת מעבר מסלול, כדי שהמצב
 * השמור תמיד יהיה חוקי — ולא ייחסם בשמירה הבאה.
 */
export function clampCardToPlan(card: CardData, targetPlan: PlanId): CardData {
  const limits = planLimits(targetPlan);
  const features = planFeatures(targetPlan);

  return {
    ...card,
    gallery: card.gallery.slice(0, limits.galleryItems),
    quickActions: card.quickActions.slice(0, limits.quickActions),
    quickActionsLimit: Math.min(card.quickActionsLimit, limits.quickActions) as CardData["quickActionsLimit"],
    tracking: features.tracking ? card.tracking : { googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "" },
    galleryStyle: features.carousel ? card.galleryStyle : "grid",
    files: features.files ? card.files : [],
    areaServed: features.seo ? card.areaServed : "",
    socialImageUrl: features.seo ? card.socialImageUrl : "",
    widgets: card.widgets.map((widget) => {
      if (widget.type === "video" && !features.video) return { ...widget, enabled: false };
      if (widget.type === "files" && !features.files) return { ...widget, enabled: false };
      return widget;
    }),
  };
}
