"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { START_TRIAL_COOKIE } from "@/lib/conversion-signals";

type Fbq = (...args: unknown[]) => void;

function readCookie(name: string) {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * StartTrial של Meta Pixel — המרה אמיתית בלבד.
 *
 * ה-flow: "14 יום התנסות" → /signup → הרשמה + אימות מייל (OTP) → שער
 * בחירת מסלול → startTrialAction → select_trial_plan במסד. רק כשהקריאה
 * האחרונה הצליחה *ופתחה התנסות חדשה*, השרת מציב עוגייה חד-פעמית ומפנה
 * לדשבורד. כאן נשלח האירוע — המשתמש כבר מחובר ובתוך המערכת.
 *
 * לא נשלח: בלחיצה על החבילה, בצפייה ב-/signup, בשליחת טופס לפני תשובת
 * השרת, בכשל (תנאים לא אושרו / התנסות שכבר מומשה), או בכניסה רגילה.
 *
 * מניעת כפילות, בשלוש שכבות:
 * 1. העוגייה נמחקת מיד — רענון, חזרה לדף וכניסה חוזרת לא ימצאו אותה.
 *    גם Strict Mode: בריצה השנייה של האפקט העוגייה כבר איננה.
 * 2. סימון ב-localStorage לפי משתמש, למקרה שהמחיקה נכשלה.
 * 3. eventID קבוע לכל משתמש — Meta מאחדת אירועים עם אותו מזהה.
 */
export function MetaConversions() {
  // redirect מ-server action הוא ניווט בתוך האפליקציה ולא טעינת דף, ולכן
  // האפקט רץ מחדש בכל שינוי נתיב ולא רק בטעינה הראשונה.
  const pathname = usePathname();

  useEffect(() => {
    const userId = readCookie(START_TRIAL_COOKIE);
    if (!userId) return;
    deleteCookie(START_TRIAL_COOKIE);

    const sentKey = `naimly:start-trial-sent:${userId}`;
    try {
      if (localStorage.getItem(sentKey)) return;
      localStorage.setItem(sentKey, new Date().toISOString());
    } catch {
      // בלי localStorage (גלישה פרטית) נשענים על מחיקת העוגייה ועל eventID.
    }

    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    fbq?.("track", "StartTrial", { value: 0, currency: "ILS" }, { eventID: `start-trial-${userId}` });
  }, [pathname]);

  return null;
}
