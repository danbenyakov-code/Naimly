import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/*
 * StartTrial של Meta הוא המרה אמיתית בלבד: הרשמה + אימות + התנסות שנפתחה
 * עכשיו במסד + כניסה למערכת. לא לחיצה על "14 יום התנסות", לא צפייה ב-SIGNUP
 * ולא שליחת טופס לפני תשובת השרת. הבדיקות כאן נועלות את נקודת ההצלחה.
 */
const read = (path: string) => readFileSync(path, "utf8");
const action = read("src/app/onboarding/plan/actions.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(tsx?|mjs)$/.test(name) ? [full] : [];
  });
}

describe("StartTrial — נקודת ההצלחה של ה-flow", () => {
  it("האות מוצב רק אחרי בדיקת השגיאה של select_trial_plan ולפני ה-redirect", () => {
    const rpc = action.indexOf('supabase.rpc("select_trial_plan"');
    const errorCheck = action.indexOf("if (error) {", rpc);
    const signal = action.indexOf("START_TRIAL_COOKIE, auth.user.id");
    // lastIndexOf: בראש הקובץ יש redirect נוסף למצב הדגמה.
    const redirectCall = action.lastIndexOf('redirect("/dashboard")');
    assert.ok(rpc > 0 && errorCheck > rpc, "חסרה קריאה ל-select_trial_plan ובדיקת שגיאה");
    assert.ok(signal > errorCheck, "האות מוצב לפני שנבדק שההתנסות הצליחה");
    assert.ok(redirectCall > signal, "האות חייב להיות מוצב לפני ה-redirect (redirect זורק)");
  });

  it("רק התנסות חדשה נספרת — לא שליחה חוזרת כשמסלול כבר נבחר", () => {
    // select_trial_plan מחזיר הצלחה גם כשמסלול כבר נבחר, בלי לפתוח התנסות.
    assert.ok(action.includes("const isNewTrial = !before?.plan_selected_at;"));
    const guard = action.indexOf("if (isNewTrial) {");
    const signal = action.indexOf("START_TRIAL_COOKIE, auth.user.id");
    assert.ok(guard > 0 && signal > guard, "האות אינו מותנה בהתנסות חדשה");
  });

  it("אין StartTrial בשום מקום אחר — לא בכפתור החבילה, לא ב-SIGNUP ולא בטופס", () => {
    const senders = sourceFiles("src").filter((file) => /['"]StartTrial['"]/.test(read(file)));
    assert.deepEqual(senders.map((file) => file.replace(/\\/g, "/")), ["src/components/meta-conversions.tsx"]);
  });

  it("אין יותר אות בכתובת (?trial=started) שאפשר להקליד ידנית או לרענן", () => {
    for (const file of sourceFiles("src")) assert.ok(!read(file).includes("trial=started"), `${file} עדיין משתמש ב-?trial=started`);
  });

  it("בדפדפן: העוגייה נמחקת לפני השליחה, ויש eventID ו-localStorage נגד כפילות", () => {
    const client = read("src/components/meta-conversions.tsx");
    const remove = client.indexOf("deleteCookie(START_TRIAL_COOKIE)");
    const send = client.indexOf('"StartTrial"');
    assert.ok(remove > 0 && send > remove, "העוגייה חייבת להימחק לפני השליחה (Strict Mode מריץ פעמיים)");
    assert.ok(client.includes("eventID: `start-trial-${userId}`"));
    assert.ok(client.includes("naimly:start-trial-sent:"));
  });
});
