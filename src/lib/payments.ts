import { billing, brand } from "@/lib/config";
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
  status: "pending" | "approved" | "rejected" | "canceled";
  createdAt: string;
};

/** קוד קצר שהלקוח מוסר בוואטסאפ ובהעברת הביט, כדי לזהות את התשלום. */
export function buildReference(userId: string, planId: string) {
  const suffix = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${planId.slice(0, 2).toUpperCase()}-${suffix}-${stamp}`;
}

export function paymentMessage(input: { plan: Plan; viewer: Pick<Viewer, "email" | "fullName">; reference: string; renewal?: boolean }) {
  const { plan, viewer, reference, renewal } = input;
  const lines = [
    `שלום ${brand.name}, אני רוצה ${renewal ? "לחדש" : "להפעיל"} מסלול ${plan.name}.`,
    "",
    `סכום: ${plan.price} ש״ח לחודש`,
    `אימייל בחשבון: ${viewer.email}`,
    `שם: ${viewer.fullName}`,
    `מספר אסמכתא: ${reference}`,
  ];
  if (billing.bitPhone) {
    lines.push("", `אשלח את התשלום בביט למספר ${billing.bitPhone} (${billing.bitDisplayName}) ואצרף צילום מסך.`);
  } else {
    lines.push("", "אשמח לקבל את פרטי התשלום בביט.");
  }
  return lines.join("\n");
}

/** קישור וואטסאפ מוכן עם ההודעה. מחזיר "" כשמספר החיוב לא הוגדר. */
export function whatsappPaymentLink(input: { plan: Plan; viewer: Pick<Viewer, "email" | "fullName">; reference: string; renewal?: boolean }) {
  if (!billing.whatsappNumber) return "";
  return `https://wa.me/${billing.whatsappNumber}?text=${encodeURIComponent(paymentMessage(input))}`;
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
