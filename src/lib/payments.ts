import { billing, brand, cycleAmount, type BillingCycle } from "@/lib/config";
import type { Plan, Viewer } from "@/lib/types";

/**
 * התשלום בפועל מתבצע בביט מול מספר העסק, והתיאום נעשה בוואטסאפ.
 * המערכת לא מחזיקה פרטי אשראי ולא מסלקת בעצמה — היא רק פותחת בקשת תשלום
 * במעקב, מנסחת את ההודעה, ומחכה לאישור ידני של מנהל.
 */

export type PaymentRequest = {
  id: string;
  reference: string;
  userId: string;
  planId: Plan["id"];
  amount: number;
  billingCycle: BillingCycle;
  status: "pending" | "approved" | "rejected" | "canceled";
  createdAt: string;
};

/** קוד קצר שהלקוח מוסר בוואטסאפ ובהעברת הביט, כדי לזהות את התשלום. */
export function buildReference(userId: string, planId: string) {
  const suffix = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${planId.slice(0, 2).toUpperCase()}-${suffix}-${stamp}`;
}

type MessageInput = {
  plan: Plan;
  viewer: Pick<Viewer, "email" | "fullName">;
  reference: string;
  renewal?: boolean;
  cycle?: BillingCycle;
  /** טלפון שהלקוח מסר בטופס, אם מסר. */
  phone?: string;
  /** גרסת המסמכים שאושרה, לתיעוד בתוך ההודעה עצמה. */
  termsVersion?: string;
  /** מועד האישור, בפורמט ISO. */
  acceptedAt?: string;
};

/** תאריך קריא בעברית, לפי שעון ישראל. */
function formatStamp(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });
}

/**
 * ההודעה שנפתחת בוואטסאפ מול מספר החיוב.
 *
 * ההודעה היא המסמך היחיד ששני הצדדים רואים ברגע התשלום, ולכן היא
 * מכילה את מלוא הפרטים: מי משלם, על מה, כמה, באיזה מחזור, לפי איזו
 * אסמכתא ותחת איזו גרסת תקנון. בלי זה המנהל מקבל העברה בביט ואין לו
 * דרך לקשור אותה לחשבון — וזו בדיוק התקלה שמגיעה אחרי שהכסף עבר.
 */
export function paymentMessage(input: MessageInput) {
  const { plan, viewer, reference, renewal } = input;
  const cycle = input.cycle || "monthly";
  const amount = cycleAmount(plan.price, cycle);
  const accepted = formatStamp(input.acceptedAt);

  /*
   * הסכום בהודעה הוא הסכום שייגבה בפועל. לקוח ששילם על שנה וקיבל
   * הודעה עם המחיר החודשי היה מעביר את הסכום הלא נכון.
   */
  const lines = [
    `שלום ${brand.name}, אני רוצה ${renewal ? "לחדש" : "להפעיל"} מסלול ${plan.name}.`,
    "",
    "── פרטי ההזמנה ──",
    `מסלול: ${plan.name}`,
    `מחזור חיוב: ${cycle === "annual" ? "שנתי — תשלום מראש ל-12 חודשים" : "חודשי מתחדש"}`,
    cycle === "annual"
      ? `סכום לתשלום: ${amount} ש״ח לשנה (כולל מע״מ)`
      : `סכום לתשלום: ${amount} ש״ח לחודש (כולל מע״מ)`,
    `מספר אסמכתא: ${reference}`,
    "",
    "── פרטי המזמין ──",
    `שם: ${viewer.fullName}`,
    `אימייל בחשבון: ${viewer.email}`,
  ];

  if (input.phone) lines.push(`טלפון: ${input.phone}`);

  if (input.termsVersion) {
    lines.push(
      "",
      "── אישור תנאים ──",
      `אישרתי את תנאי השימוש ומדיניות הפרטיות, גרסה ${input.termsVersion}${accepted ? ` (${accepted})` : ""}.`,
    );
  }

  lines.push("", "── תשלום ──");
  if (billing.bitPhone) {
    lines.push(`אשלח את התשלום בביט למספר ${billing.bitPhone} (${billing.bitDisplayName}) ואצרף צילום מסך.`);
  } else {
    lines.push("אשמח לקבל את פרטי התשלום בביט.");
  }

  return lines.join("\n");
}

/** קישור וואטסאפ מוכן עם ההודעה. מחזיר "" כשמספר החיוב לא הוגדר. */
export function whatsappPaymentLink(input: MessageInput) {
  if (!billing.whatsappNumber) return "";
  return `https://wa.me/${billing.whatsappNumber}?text=${encodeURIComponent(paymentMessage(input))}`;
}

/**
 * קישור התשלום שמנהל שולח מתוך /admin/payments, אחרי שבדק את הבקשה.
 *
 * בשונה מ-paymentMessage: מקבל את הסכום הסופי כפי שכבר נשמר כ-snapshot
 * על הבקשה (payment_requests.amount), ולא מחשב אותו מחדש ממחיר חודשי
 * ומחזור — כדי שהקישור תמיד יתאים בדיוק למה שהאדמין רואה במסך.
 */
export function orderPaymentMessage(input: { planName: string; amount: number; cycle: BillingCycle; reference: string; customerName: string }) {
  const lines = [
    `שלום ${brand.name}, מאשר/ת תשלום עבור חבילת ${input.planName}.`,
    "",
    "── פרטי ההזמנה ──",
    `מסלול: ${input.planName}`,
    `מחזור חיוב: ${input.cycle === "annual" ? "שנתי — תשלום מראש ל-12 חודשים" : "חודשי מתחדש"}`,
    `סכום לתשלום: ${input.amount} ש״ח (כולל מע״מ)`,
    `מספר עסקה: ${input.reference}`,
    `שם: ${input.customerName}`,
    "",
    "── תשלום ──",
  ];
  if (billing.bitPhone) {
    lines.push(`אשלח את התשלום בביט למספר ${billing.bitPhone} (${billing.bitDisplayName}) ואצרף צילום מסך.`);
  } else {
    lines.push("אשמח לקבל את פרטי התשלום בביט.");
  }
  return lines.join("\n");
}

/** קישור וואטסאפ מוכן לתשלום ההזמנה. מחזיר "" כשמספר החיוב לא הוגדר. */
export function orderWhatsappPaymentLink(input: { planName: string; amount: number; cycle: BillingCycle; reference: string; customerName: string }) {
  if (!billing.whatsappNumber) return "";
  return `https://wa.me/${billing.whatsappNumber}?text=${encodeURIComponent(orderPaymentMessage(input))}`;
}

/** הודעת וואטסאפ שהמנהל שולח ללקוח עם פרטי הכניסה. */
export function credentialsMessage(input: { email: string; password?: string; loginUrl: string; planName: string; resetLink?: string }) {
  const lines = [
    `היי! החשבון שלך ב${brand.name} מוכן 🎉`,
    "",
    `מסלול: ${input.planName}`,
    `כתובת כניסה: ${input.loginUrl}`,
    `שם משתמש: ${input.email}`,
  ];
  if (input.password) {
    lines.push(`סיסמה זמנית: ${input.password}`, "", "מומלץ להחליף סיסמה מיד אחרי הכניסה הראשונה.");
  }
  if (input.resetLink) {
    lines.push("", `קישור לקביעת סיסמה (בתוקף לשעה): ${input.resetLink}`);
  }
  return lines.join("\n");
}

export function whatsappTo(phone: string, message: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
