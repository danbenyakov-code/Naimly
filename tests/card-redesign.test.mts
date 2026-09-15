import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  defaultOpeningHours, groupHours, nowInBusinessTime, openState, openStateLabel, toMinutes,
  type OpeningHours,
} from "../src/lib/opening-hours.ts";
import { cardTemplate, cardTemplateIds, cardTemplates, orderWidgets } from "../src/lib/card-templates.ts";
import { actionIcons, actionLabels, opensInSameTab, quickActionTypes } from "../src/lib/card-actions.ts";
import { planFeatures } from "../src/lib/plan-access.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

/** יום שלם פתוח בשעות נתונות. */
const day = (index: number, open = "09:00", close = "18:00"): OpeningHours => ({ day: index, closed: false, allDay: false, open, close });
const closed = (index: number): OpeningHours => ({ day: index, closed: true, allDay: false, open: "", close: "" });
const allDay = (index: number): OpeningHours => ({ day: index, closed: false, allDay: true, open: "", close: "" });

/** תאריך בשעון ישראל, לבדיקות דטרמיניסטיות. */
const at = (iso: string) => new Date(iso);

describe("שעות פעילות — פענוח שעה", () => {
  it("שעה תקינה", () => {
    assert.equal(toMinutes("00:00"), 0);
    assert.equal(toMinutes("09:30"), 570);
    assert.equal(toMinutes("23:59"), 1439);
  });

  it("קלט פגום מוחזר כ-null ולא כאפס", () => {
    /*
     * אפס פירושו חצות, וחצות היא שעה תקינה. החזרת אפס על קלט פגום
     * הייתה הופכת שעה שבורה ל"פתוח מחצות".
     */
    for (const value of ["", "9:30", "0930", "24:00", "09:60", "ab:cd", "09:3a", "09-30"]) {
      assert.equal(toMinutes(value), null, JSON.stringify(value));
    }
  });
});

describe("שעות פעילות — סטטוס", () => {
  it("בלי שעות מוגדרות אין סטטוס", () => {
    // הצגת "סגור" לעסק שלא הגדיר שעות היא המצאה, בדיוק כמו "פתוח".
    assert.equal(openState([]).state, "unknown");
    assert.equal(openStateLabel(openState([])), "");
  });

  it("פתוח בתוך השעות", () => {
    // 2026-09-14 הוא יום שני; 12:00 UTC = 15:00 בישראל.
    const state = openState([day(1)], at("2026-09-14T12:00:00Z"));
    assert.equal(state.state, "open");
    if (state.state === "open") assert.equal(state.closesAt, "18:00");
  });

  it("סגור לפני הפתיחה — ומציין מתי ייפתח היום", () => {
    // 04:00 UTC = 07:00 בישראל, לפני 09:00.
    const state = openState([day(1)], at("2026-09-14T04:00:00Z"));
    assert.equal(state.state, "closed");
    if (state.state === "closed") assert.equal(state.opensAt, "09:00");
  });

  it("אחרי הסגירה מפנה ליום הפתוח הבא", () => {
    /*
     * בלי המעבר הזה, עסק שסגור בערב היה מציג "סגור" בלי לומר מתי
     * יחזור — וזו בדיוק השאלה של הלקוח.
     */
    const hours = [day(1), closed(2), day(3, "10:00", "16:00")];
    // 19:00 UTC ביום שני = 22:00 בישראל, אחרי הסגירה.
    const state = openState(hours, at("2026-09-14T19:00:00Z"));
    assert.equal(state.state, "closed");
    if (state.state === "closed") {
      assert.equal(state.opensDay, 3, "יום שלישי סגור, ולכן רביעי");
      assert.equal(state.opensAt, "10:00");
    }
  });

  it("סגור בכל ימות השבוע", () => {
    const state = openState([0, 1, 2, 3, 4, 5, 6].map(closed), at("2026-09-14T12:00:00Z"));
    assert.equal(state.state, "closed_today");
    assert.equal(openStateLabel(state), "סגור");
  });

  it("שעת פתיחה פגומה אינה מייצרת 'פתוח'", () => {
    const broken: OpeningHours[] = [{ day: 1, closed: false, allDay: false, open: "9:00", close: "18:00" }];
    assert.notEqual(openState(broken, at("2026-09-14T12:00:00Z")).state, "open");
  });

  it("היום הנוכחי נקבע בשעון ישראל ולא ב-UTC", () => {
    // 21:30 UTC בשבת = 00:30 ביום ראשון בישראל.
    const { day: weekday } = nowInBusinessTime(at("2026-09-19T21:30:00Z"));
    assert.equal(weekday, 0, "שבת ב-UTC אך ראשון בישראל");
  });
});

describe("שעות פעילות — תצוגה", () => {
  it("ימים רצופים זהים מתכווצים לשורה אחת", () => {
    // שבע שורות זהות הן רעש; כך עסקים מציגים שעות בפועל.
    const groups = groupHours([day(0), day(1), day(2), day(3), day(4), day(5, "09:00", "13:00"), closed(6)]);
    assert.equal(groups.length, 3);
    assert.equal(groups[0].label, "ראשון–חמישי");
    assert.equal(groups[0].value, "09:00–18:00");
    assert.equal(groups[2].value, "סגור");
  });

  it("יום בודד מוצג בשמו", () => {
    const groups = groupHours([day(0), closed(1)]);
    assert.equal(groups[0].label, "ראשון");
  });

  it("ברירת המחדל מכסה שבעה ימים", () => {
    const hours = defaultOpeningHours();
    assert.equal(hours.length, 7);
    assert.deepEqual(hours.map((entry) => entry.day), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(hours[6].closed, true, "שבת סגורה כברירת מחדל");
  });
});

describe("תבניות הכרטיס (BENCH-007)", () => {
  it("התבנית כבר אינה שדה מת", () => {
    /*
     * template נשמר, עבר ולידציה ולא נקרא מעולם. שדה שמתחזה ליכולת
     * גרוע משדה שאינו קיים.
     */
    const preview = read("src/components/card/card-preview.tsx");
    assert.ok(preview.includes("cardTemplate(card.template)"));
    assert.ok(preview.includes("orderWidgets(enabled, card.template)"));
    assert.ok(read("src/components/dashboard/card-builder-v2.tsx").includes("cardTemplates.map"));
  });

  it("קיימות תבניות לפי תחום", () => {
    assert.ok(cardTemplates.length >= 5, `רק ${cardTemplates.length} תבניות`);
    for (const template of cardTemplates) {
      assert.ok(template.name.length > 0);
      assert.ok(template.audience.length > 0, `${template.id} ללא קהל יעד`);
    }
  });

  it("מזהה לא מוכר נופל לברירת מחדל ולא קורס", () => {
    assert.equal(cardTemplate(undefined).id, "spotlight");
    assert.equal(cardTemplate("no-such-template").id, "spotlight");
    assert.equal(cardTemplate("portfolio").id, "portfolio");
  });

  it("הולידציה נגזרת מהספרייה", () => {
    // רשימה מוקלדת בנפרד הייתה דוחה תבנית חדשה בשרת.
    assert.ok(read("src/lib/validation.ts").includes("cardTemplateIds"));
    assert.ok(cardTemplateIds.includes("local"));
  });

  it("החלפת תבנית אינה מוחקת מקטע", () => {
    /*
     * זו ההתחייבות המרכזית של התבניות: הן מסדרות, לא מסננות. מקטע
     * שאינו מופיע בסדר המוצע חייב לשרוד.
     */
    const widgets = [
      { type: "contact_form" as const, id: "a" },
      { type: "gallery" as const, id: "b" },
      { type: "services" as const, id: "c" },
    ];
    for (const template of cardTemplates) {
      const ordered = orderWidgets(widgets, template.id);
      assert.equal(ordered.length, widgets.length, `${template.id} איבד מקטע`);
      for (const widget of widgets) {
        assert.ok(ordered.some((item) => item.id === widget.id), `${template.id} איבד את ${widget.id}`);
      }
    }
  });

  it("תבנית 'תיק עבודות' מקדימה את הגלריה", () => {
    const widgets = [{ type: "services" as const, id: "s" }, { type: "gallery" as const, id: "g" }];
    assert.equal(orderWidgets(widgets, "portfolio")[0].id, "g");
    assert.equal(orderWidgets(widgets, "services")[0].id, "s");
  });
});

describe("פעולות הכרטיס", () => {
  it("הסוגים שביקש הלקוח קיימים", () => {
    for (const type of ["sms", "messenger", "telegram", "gmail", "instagram", "youtube", "custom"] as const) {
      assert.ok(quickActionTypes.includes(type), `חסר ${type}`);
      assert.ok(actionIcons[type], `אין אייקון ל-${type}`);
      assert.ok(actionLabels[type], `אין תווית ל-${type}`);
    }
  });

  it("לכל סוג יש אייקון ותווית", () => {
    // סוג בלי אייקון מרנדר ריק בכרטיס חי.
    for (const type of quickActionTypes) {
      assert.ok(actionIcons[type], `אין אייקון ל-${type}`);
      assert.ok(actionLabels[type], `אין תווית ל-${type}`);
    }
  });

  it("פעולות שמפעילות אפליקציה נפתחות באותה לשונית", () => {
    // target=_blank על tel: או mailto: פותח לשונית ריקה במקום את האפליקציה.
    for (const type of ["phone", "sms", "email", "whatsapp", "save_contact"] as const) {
      assert.equal(opensInSameTab(type), true, type);
    }
    assert.equal(opensInSameTab("website"), false);
    assert.equal(opensInSameTab("instagram"), false);
  });

  it("כפתור משלי נושא אייקון שהלקוח מעלה", () => {
    assert.ok(read("src/lib/types.ts").includes("iconUrl?: string"));
    assert.ok(read("src/components/dashboard/card-builder-v2.tsx").includes("uploadActionIcon"));
  });
});

describe("הכפתור הראשי (BENCH-003)", () => {
  const cta = read("src/components/card/primary-cta.tsx");

  it("ארבעה סוגים לבחירה, לא וואטסאפ בלבד", () => {
    for (const type of ["whatsapp", "phone", "lead", "meeting"]) {
      assert.ok(cta.includes(`"${type}"`), `חסר ${type}`);
    }
  });

  it("כפתור בלי יעד תקין אינו מוצג", () => {
    // קישור ראשי שבור גרוע מהיעדר כפתור.
    assert.ok(cta.includes("if (!href) return null"));
  });

  it("ctaLabel הישן נשמר כברירת מחדל", () => {
    assert.ok(cta.includes("card.ctaLabel"), "כרטיס ותיק לא אמור לאבד את הטקסט שלו");
  });
});

describe("מבנה הכרטיס", () => {
  it("המקטעים הופרדו לרכיבים", () => {
    for (const path of [
      "src/components/card/sections/section-shell.tsx",
      "src/components/card/sections/card-sections.tsx",
      "src/components/card/sections/hours-section.tsx",
    ]) {
      assert.ok(fs.existsSync(path), `חסר ${path}`);
    }
  });

  it("מקטע בלי תוכן אינו מוצג כלל", () => {
    // כותרת מעל ריק היא הבטחה שנשברת.
    assert.ok(read("src/components/card/sections/section-shell.tsx").includes("if (!hasContent) return null"));
  });

  it("תקרת הגלריה נקבעת במסלול ולא בקוד", () => {
    // slice(0, 12) הציג חצי גלריה ללקוח שמשלם על 24.
    const sections = read("src/components/card/sections/card-sections.tsx");
    assert.ok(!sections.includes("slice(0, 12)"), "נשארה תקרה קשיחה");
  });

  it("המיקום מוצג ב-Hero", () => {
    // עיר ואזור שירות הוזנו ולא הוצגו מעולם.
    assert.ok(read("src/components/card/card-preview.tsx").includes("heroLocation"));
  });

  it("תג הזמינות נגזר מהשעות ואינו קבוע", () => {
    /*
     * התג הוצג תמיד, גם בשבת בחצות — הצהרה שאינה נמדדת על עמוד ציבורי.
     */
    const preview = read("src/components/card/card-preview.tsx");
    assert.ok(preview.includes("openStateLabel(openState(card.openingHours"));
    assert.ok(!preview.includes(">זמין לפניות<"), "נשאר תג קבוע");
  });
});

describe("האילוץ במסד תואם לספרייה בקוד", () => {
  it("כל תבנית בקוד מותרת גם במסד", () => {
    /*
     * המסד דחה את התבניות החדשות כשהספרייה גדלה — וזו הייתה ההתנהגות
     * הנכונה. הבדיקה כאן תופסת את הפער לפני שהוא מגיע לייצור.
     */
    const migration = read("supabase/migrations/022_card_templates.sql");
    const allowed = migration.slice(migration.lastIndexOf("check (template in ("));
    for (const id of cardTemplateIds) {
      assert.ok(allowed.includes(`'${id}'`), `${id} אינו מותר במסד`);
    }
  });
});

describe("פתוח 24 שעות", () => {
  it("יום פתוח כל היממה מציג סטטוס בלי שעת סגירה", () => {
    /*
     * עסק 24/7 לא אמור למלא 00:00–23:59 ולקוות שזה ייראה נכון.
     * 20:00 UTC = 23:00 בישראל, עדיין יום שני ומחוץ לשעות רגילות.
     */
    const state = openState([allDay(1)], at("2026-09-14T20:00:00Z"));
    assert.equal(state.state, "open");
    assert.equal(openStateLabel(state), "פתוח 24 שעות");
  });

  it("בתצוגה השבועית מופיע 'פתוח 24 שעות'", () => {
    const groups = groupHours([allDay(0), allDay(1), closed(2)]);
    assert.equal(groups[0].value, "פתוח 24 שעות");
    assert.equal(groups[0].label, "ראשון–שני", "ימים רצופים זהים מתכווצים גם כאן");
  });

  it("24 שעות אינו מתמזג עם טווח שעות", () => {
    const groups = groupHours([allDay(0), day(1), closed(2)]);
    assert.equal(groups.length, 3, "אלה שתי הגדרות שונות");
  });
});

describe("שעות פעילות כיכולת של מסלול", () => {
  it("בסיסי אינו כולל שעות; מקצועי ומעלה כן", () => {
    assert.equal(planFeatures("basic").hours, false);
    assert.equal(planFeatures("pro").hours, true);
    assert.equal(planFeatures("premium").hours, true);
    assert.equal(planFeatures("trial").hours, true);
  });

  it("האכיפה קיימת בשלוש השכבות", () => {
    // נעילה בממשק בלבד נעקפת בבקשה ישירה ל-API.
    assert.ok(read("src/components/dashboard/card-builder-v2.tsx").includes('lockPrompt("hours")'));
    assert.ok(read("src/app/api/cards/route.ts").includes("!features.hours && parsed.data.openingHours.length"));
    assert.ok(read("supabase/migrations/023_hours_plan_feature.sql").includes("PLAN_LIMIT:hours"));
  });

  it("גיזום למסלול מסיר שעות שאינן כלולות", () => {
    assert.ok(read("src/lib/plan-access.ts").includes("openingHours: features.hours ? card.openingHours : []"));
  });

  it("מופיע בטבלת ההשוואה", () => {
    assert.ok(read("src/app/pricing/page.tsx").includes("planFeatures(plan.id).hours"));
  });
});
