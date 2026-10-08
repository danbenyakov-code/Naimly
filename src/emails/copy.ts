/**
 * כל הטקסטים של המיילים, במקום אחד.
 *
 * כדי לשנות ניסוח: עורכים רק כאן. התבניות (קבצי ה-tsx בתיקייה הזו) לוקחות
 * מכאן את הנושא, הכותרות, הפסקאות והכפתורים, ולא מכילות טקסט משלהן.
 *
 * כללים:
 *   - בלי מקף ארוך. נקודתיים, פסיק או מקף רגיל.
 *   - {משתנים} מוחלפים בפונקציות. מספרים מגיעים כבר מעוצבים.
 *   - name יכול להיות ריק (לקוח בלי שם בפרופיל), ולכן הפנייה נבנית ב-hi().
 */

const hi = (name: string) => (name ? `היי ${name},` : "היי,");
/** "יום אחד", "יומיים", "3 ימים". */
const daysText = (count: number) => (count === 1 ? "יום אחד" : count === 2 ? "יומיים" : `${count} ימים`);

export type CardStats = { views: number; clicks: number; leads: number };

// ─────────────────────────────────────────────────────────────────────────────
// משותף לכל המיילים
// ─────────────────────────────────────────────────────────────────────────────

export const common = {
  brandTagline: "כרטיס ביקור דיגיטלי ומיני סייט לעסקים",
  unsubscribe: "לא לקבל יותר מיילים מאיתנו",
  managePreferences: "ניהול העדפות דיוור",
  marketingFooter: "קיבלת את המייל הזה כי נרשמת ל־NAIMLY.",
  serviceFooter: "זהו מייל שירות על החשבון שלך, ולכן הוא נשלח תמיד.",
  questions: "יש שאלה? פשוט להשיב למייל הזה או לכתוב לנו בוואטסאפ.",
  whatsappUs: "לכתוב לנו בוואטסאפ",
  statsLabels: { views: "צפיות", clicks: "לחיצות", leads: "פניות" },
};

// ─────────────────────────────────────────────────────────────────────────────
// מיילי סיום ניסיון
// ─────────────────────────────────────────────────────────────────────────────

export type TrialEmailInput = {
  name: string;
  businessName: string;
  /** ימים שנותרו, לפי תאריך לוח בשעון ישראל. */
  daysLeft: number;
  hasCard: boolean;
  stats: CardStats;
};

export const trialCopy = {
  cta: "בחירת מסלול",
  priceNote: "החל מ־29 ₪ לחודש, בלי התחייבות.",

  ending: (input: TrialEmailInput) => {
    const days = daysText(input.daysLeft);
    const card = input.businessName ? `הכרטיס של ${input.businessName}` : "הכרטיס שלך";
    if (!input.hasCard) {
      return {
        subject: `נשארו ${days} לניסיון שלך ב־NAIMLY`,
        preview: "בניית הכרטיס לוקחת פחות מרבע שעה",
        heading: `נשארו ${days} לניסיון`,
        paragraphs: [
          hi(input.name),
          "עוד לא בנית את הכרטיס? זה לוקח פחות מרבע שעה: מעלים לוגו, ממלאים פרטים, והכרטיס באוויר עם קישור ו־QR משלו.",
          `יש לך עוד ${days} לנסות הכל בחינם, כולל כל היכולות של מסלול פרימיום.`,
        ],
        cta: "לבניית הכרטיס",
        showStats: false,
      };
    }
    return {
      subject: `נשארו ${days} לניסיון שלך ב־NAIMLY`,
      preview: `${card} קיבל ${input.stats.views} צפיות מאז שהתחלת`,
      heading: `נשארו ${days} לניסיון`,
      paragraphs: [
        hi(input.name),
        `עוד ${days} מסתיימת תקופת הניסיון שלך. מאז שהתחלת, ${card} קיבל:`,
      ],
      after: "כדי שהכרטיס ימשיך לעבוד בשבילך בלי הפסקה, אפשר לבחור מסלול כבר עכשיו.",
      cta: "בחירת מסלול",
      showStats: true,
    };
  },

  lastDay: (input: TrialEmailInput) => {
    const when = input.daysLeft <= 0 ? "היום" : "מחר";
    if (!input.hasCard) {
      return {
        subject: `${when} מסתיים הניסיון שלך`,
        preview: "עוד יש זמן לבנות את הכרטיס",
        heading: `${when} מסתיים הניסיון`,
        paragraphs: [
          hi(input.name),
          `${when} בסוף היום מסתיימת תקופת הניסיון, והכרטיס שלך עוד לא נבנה.`,
          "רבע שעה זה כל מה שצריך. וגם אחרי הניסיון, כל מה שתבנה יישמר ויחכה לך.",
        ],
        cta: "לבניית הכרטיס",
        showStats: false,
      };
    }
    return {
      subject: `${when} מסתיים הניסיון שלך`,
      preview: `${input.stats.views} צפיות ו־${input.stats.leads} פניות עד עכשיו`,
      heading: `${when} מסתיים הניסיון`,
      paragraphs: [
        hi(input.name),
        `${when} בסוף היום מסתיימת תקופת הניסיון. הכרטיס שלך כבר בנוי ועובד, והנה מה שהוא עשה עד עכשיו:`,
      ],
      after: "בחירת מסלול לוקחת דקה, והכרטיס, הקישור וה־QR נשארים בדיוק כמו שהם.",
      cta: "בחירת מסלול",
      showStats: true,
    };
  },

  ended: (input: TrialEmailInput) => {
    if (!input.hasCard) {
      return {
        subject: "תקופת הניסיון שלך הסתיימה",
        preview: "אפשר להמשיך מאיפה שעצרת",
        heading: "תקופת הניסיון הסתיימה",
        paragraphs: [
          hi(input.name),
          "תקופת הניסיון של 14 יום הסתיימה. אם עוד לא הספקת לבנות את הכרטיס, זה בסדר: בוחרים מסלול, ותוך רבע שעה העסק שלך באוויר.",
          common.questions,
        ],
        cta: "בחירת מסלול",
        showStats: false,
      };
    }
    return {
      subject: "תקופת הניסיון שלך הסתיימה",
      preview: "כל מה שבנית שמור אצלנו",
      heading: "תקופת הניסיון הסתיימה",
      paragraphs: [
        hi(input.name),
        "תקופת הניסיון של 14 יום הסתיימה. כל מה שבנית שמור אצלנו: העיצוב, התמונות, הפניות והנתונים.",
        "בזמן הניסיון הכרטיס שלך קיבל:",
      ],
      after: `כדי להחזיר את הכרטיס לפעילות מלאה, בוחרים מסלול ומשם הכל ממשיך בדיוק מאיפה שעצרת. ${common.questions}`,
      cta: "בחירת מסלול",
      showStats: true,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// דוח שבועי
// ─────────────────────────────────────────────────────────────────────────────

export type WeeklyStats = CardStats & { whatsapp: number; phone: number; navigation: number; contactSave: number };

export const weeklyCopy = {
  report: (input: { name: string; thisWeek: WeeklyStats; lastWeek: WeeklyStats }) => ({
    subject: `הכרטיס שלך קיבל ${input.thisWeek.views} צפיות השבוע`,
    preview: `${input.thisWeek.views} צפיות, ${input.thisWeek.clicks} לחיצות ו־${input.thisWeek.leads} פניות`,
    heading: "הדוח השבועי של הכרטיס שלך",
    intro: `${hi(input.name)} ככה נראה השבוע של הכרטיס שלך:`,
    actionsTitle: "מה לחצו",
    actions: {
      whatsapp: "וואטסאפ",
      phone: "חיוג",
      navigation: "ניווט",
      contactSave: "שמירת איש קשר",
    },
    comparison: "לעומת השבוע הקודם",
    cta: "לכל הנתונים",
  }),

  tips: (input: { name: string }) => ({
    subject: "3 דרכים להביא צפיות לכרטיס שלך השבוע",
    preview: "הכרטיס מוכן, עכשיו צריך שיראו אותו",
    heading: "הכרטיס מוכן, עכשיו צריך שיראו אותו",
    intro: `${hi(input.name)} השבוע עוד לא היו צפיות בכרטיס. הנה 3 דרכים פשוטות שעובדות:`,
    tips: [
      { title: "קישור בביו באינסטגרם", body: "מדביקים את הקישור לכרטיס בביו. כל מי שנכנס לפרופיל מגיע ישר לוואטסאפ, לחיוג ולניווט." },
      { title: "סטטוס בוואטסאפ", body: "מעלים סטטוס עם הקישור ומשפט אחד על העסק. אנשים שכבר מכירים אותך הם הלקוחות הכי קרובים." },
      { title: "QR בעסק", body: "מדפיסים את ה־QR ושמים בדלפק, בחלון הראווה או על כרטיס הביקור. סריקה אחת ואיש הקשר נשמר בטלפון." },
    ],
    cta: "לקישור ול־QR של הכרטיס",
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// התראה על פנייה חדשה (מייל קריטי, תמיד נשלח)
// ─────────────────────────────────────────────────────────────────────────────

export const leadCopy = {
  subject: (businessName: string) => `פנייה חדשה מהכרטיס של ${businessName}`,
  preview: (leadName: string) => `${leadName} השאיר/ה פרטים בכרטיס שלך`,
  heading: "פנייה חדשה 🎉",
  intro: (businessName: string) => `מישהו השאיר פרטים בכרטיס של ${businessName}. כדאי לחזור אליו מהר: פנייה שנענית תוך שעה נסגרת הרבה יותר.`,
  labels: { name: "שם", phone: "טלפון", email: "אימייל", message: "הודעה" },
  replyWhatsapp: "השב בוואטסאפ",
  whatsappGreeting: (leadName: string, businessName: string) => `היי ${leadName}, כאן ${businessName}. קיבלתי את הפנייה שלך 🙂`,
  allLeads: "צפייה בכל הפניות",
};
