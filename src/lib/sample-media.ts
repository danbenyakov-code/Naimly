/**
 * תמונות הדוגמה של כרטיס ההדגמה.
 *
 * הקבצים יושבים ב-public/samples ומוגשים מאותו מקור, כי ה-CSP מתיר
 * `img-src 'self' data:` בלבד — תמונה מדומיין חיצוני תיחסם בשקט.
 *
 * אם הקבצים אינם קיימים, CardPreview נופל לרקע הגרדיאנט ולראשי התיבות
 * דרך onError. אין צורך בבדיקת קיום בשרת.
 */

/** דיוקן/לוגו לכרטיס ההדגמה. */
export const SAMPLE_LOGO = "/samples/logo-example.jpg";

/** תמונת קאבר לכרטיס ההדגמה. */
export const SAMPLE_COVER = "/samples/cover-example.jpg";
