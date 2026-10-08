"use client";

import { useState, useTransition } from "react";
import { BellOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateNotificationPreferencesAction, type NotificationPreferences } from "@/app/dashboard/settings/notifications/actions";
import { updatePreferencesByTokenAction } from "@/app/email-preferences/actions";

const options: Array<{ key: keyof NotificationPreferences; title: string; description: string }> = [
  { key: "trial_reminders", title: "תזכורות על תקופת הניסיון", description: "כמה ימים לפני שהניסיון מסתיים, עם הנתונים של הכרטיס שלך." },
  { key: "weekly_report", title: "דוח שבועי", description: "כל יום ראשון: צפיות, לחיצות ופניות בכרטיס, לעומת השבוע הקודם." },
  { key: "product_updates", title: "עדכוני מוצר", description: "יכולות חדשות בכרטיס ובמערכת." },
  { key: "marketing", title: "הצעות ומבצעים", description: "הנחות ומבצעים מיוחדים, מדי פעם." },
];

const critical = ["קוד אימות בהרשמה", "איפוס סיסמה", "אישור תשלום וקבלה", "התראה על פנייה חדשה מהכרטיס"];

/**
 * המתגים משמשים בשני מקומות: בהגדרות החשבון (משתמש מחובר), ובקישור מתוך
 * מייל (token, בלי התחברות). שניהם כותבים לאותה שורה בדיוק.
 */
export function NotificationPreferencesForm({ initial, token }: { initial: NotificationPreferences; token?: string }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const allOff = options.every(({ key }) => !values[key]);

  function save(changes: Partial<NotificationPreferences>, okText: string) {
    const previous = values;
    setValues({ ...values, ...changes });
    setMessage(null);
    startTransition(async () => {
      const result = token ? await updatePreferencesByTokenAction(token, changes) : await updateNotificationPreferencesAction(changes);
      if (result.ok) setMessage({ tone: "ok", text: okText });
      else {
        setValues(previous);
        setMessage({ tone: "error", text: result.error || "לא הצלחנו לשמור" });
      }
    });
  }

  return (
    <div className="mt-6 grid gap-5">
      <section className="card-surface divide-y divide-[#edf0f5]">
        {options.map(({ key, title, description }) => (
          <div key={key} className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <h2 id={`pref-${key}`} className="font-bold text-[#18243a]">{title}</h2>
              <p className="mt-0.5 text-sm text-[#68758a]">{description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values[key]}
              aria-labelledby={`pref-${key}`}
              disabled={pending}
              onClick={() => save({ [key]: !values[key] }, "ההעדפות נשמרו")}
              className={cn("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60", values[key] ? "bg-[#6d4aff]" : "bg-[#c7ced9]")}
            >
              <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", values[key] ? "right-6" : "right-1")} />
            </button>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={pending || allOff}
          onClick={() => save({ trial_reminders: false, weekly_report: false, product_updates: false, marketing: false }, "כל המיילים השיווקיים בוטלו")}
          className="button-secondary min-h-11 gap-2 px-4 text-sm disabled:opacity-50"
        >
          <BellOff size={16} aria-hidden="true" />
          בטל את כל המיילים השיווקיים
        </button>
        <p role="status" aria-live="polite" className={cn("text-sm font-bold", message?.tone === "error" ? "text-[#a32031]" : "text-[#08735f]")}>
          {message?.text}
        </p>
      </div>

      <section className="rounded-2xl border border-[#e2e6ee] bg-[#f8f9fc] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#6d4aff]" aria-hidden="true" />
          <h2 className="font-bold text-[#18243a]">מיילים שתמיד נשלחים</h2>
        </div>
        <p className="mt-1 text-sm text-[#68758a]">אלה מיילים חיוניים לחשבון, ולכן אי אפשר לבטל אותם:</p>
        <ul className="mt-2 grid gap-1 text-sm text-[#4a5871]">
          {critical.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </section>
    </div>
  );
}
