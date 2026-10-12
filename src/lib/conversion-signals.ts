/**
 * אותות חד-פעמיים מהשרת לדפדפן על המרה אמיתית (Meta Pixel).
 *
 * השרת מציב את העוגייה רק אחרי שהפעולה הצליחה במסד — לא לחיצה ולא
 * שליחת טופס. MetaConversions קורא אותה, שולח את האירוע ומוחק אותה מיד.
 * עוגייה ולא פרמטר בכתובת: כתובת אפשר להקליד ידנית, לרענן ולשתף.
 */
export const START_TRIAL_COOKIE = "naimly_start_trial";

/** הרשמה שהושלמה (המייל אומת) — מוצב לפני שלב בחירת המסלול. */
export const COMPLETE_REGISTRATION_COOKIE = "naimly_complete_registration";

/** חלון הזמן בין הצלחת ההתנסות בשרת לבין טעינת הדשבורד. */
export const CONVERSION_SIGNAL_MAX_AGE_SECONDS = 600;
