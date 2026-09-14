import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatIsraeliPhone, isActionUsable, missingVCardFields, resolveActionValue, resolveVCard, socialUrl, toE164, whatsappLink } from "../src/lib/contact-source.ts";

/** בדיקות לקבוצה ב׳ בדוח ה-QA: QA-024, QA-025, QA-026. */

describe("QA-025 — נרמול מספר ל-E.164", () => {
  it("צעד השחזור המקורי: 0501234567 → wa.me/972501234567", () => {
    assert.equal(whatsappLink("0501234567"), "https://wa.me/972501234567");
  });

  it("מסיר מקפים, רווחים וסוגריים", () => {
    for (const input of ["050-123-4567", "050 123 4567", "(050) 123-4567", "050.123.4567"]) {
      assert.equal(toE164(input), "972501234567", `נכשל על ${input}`);
    }
  });

  it("מקבל פורמט בינלאומי בכל צורותיו", () => {
    assert.equal(toE164("+972501234567"), "972501234567");
    assert.equal(toE164("00972501234567"), "972501234567");
    assert.equal(toE164("972501234567"), "972501234567");
  });

  it("מספר קווי ישראלי", () => {
    assert.equal(toE164("03-5551234"), "97235551234");
    assert.equal(toE164("02-1234567"), "97221234567");
  });

  it("מספר שאי אפשר לנרמל מחזיר ריק ולא קישור שבור", () => {
    for (const bad of ["", "   ", "abc", "12", "+", "05"]) {
      assert.equal(toE164(bad), "", `${JSON.stringify(bad)} היה אמור להידחות`);
      assert.equal(whatsappLink(bad), "", "אסור לייצר קישור ממספר פסול");
    }
  });

  it("הודעה מצורפת מקודדת נכון", () => {
    const link = whatsappLink("0501234567", "שלום, הגעתי מהכרטיס");
    assert.ok(link.startsWith("https://wa.me/972501234567?text="));
    assert.ok(!link.includes(" "), "רווחים חייבים להיות מקודדים");
  });

  it("תצוגה קריאה למשתמש", () => {
    assert.equal(formatIsraeliPhone("972501234567"), "050-123-4567");
    assert.equal(formatIsraeliPhone("0501234567"), "050-123-4567");
  });
});

describe("QA-026 — בניית כתובת לרשת חברתית", () => {
  it("צעד השחזור המקורי: naimly.qa ללא https", () => {
    assert.equal(socialUrl("instagram", "naimly.qa"), "https://instagram.com/naimly.qa");
    assert.equal(socialUrl("facebook", "naimly.qa"), "https://facebook.com/naimly.qa");
  });

  it("שם משתמש עם @ מוביל", () => {
    assert.equal(socialUrl("instagram", "@naimly"), "https://instagram.com/naimly");
    assert.equal(socialUrl("tiktok", "@naimly"), "https://tiktok.com/@naimly");
  });

  it("כתובת מלאה מתקבלת כמות שהיא", () => {
    assert.equal(socialUrl("instagram", "https://instagram.com/naimly"), "https://instagram.com/naimly");
  });

  it("כתובת בלי סכימה מקבלת https", () => {
    assert.equal(socialUrl("instagram", "instagram.com/naimly"), "https://instagram.com/naimly");
  });

  it("ערך ריק מחזיר ריק ולא #", () => {
    assert.equal(socialUrl("instagram", ""), "");
    assert.equal(socialUrl("facebook", "   "), "");
  });

  it("כל הרשתות הנתמכות בונות כתובת", () => {
    for (const network of ["instagram", "facebook", "linkedin", "tiktok", "youtube", "x", "threads"]) {
      const url = socialUrl(network, "naimly");
      assert.ok(url.startsWith("https://"), `${network} לא בנה כתובת`);
      assert.ok(url.includes("naimly"), `${network} איבד את שם המשתמש`);
    }
  });
});

describe("QA-024 — הפעולות נגזרות מפרטי הכרטיס", () => {
  const card = {
    phone: "03-5551234", whatsapp: "0501234567", email: "info@example.co.il",
    website: "https://naimly.co.il", address: "אלנבי 42, תל אביב",
    ownerName: "דן בן יעקב", businessName: "מאפיית לחם הארץ", roleTitle: "בעלים",
  };

  it("פעולה בלי ערך משלה יורשת מהכרטיס", () => {
    assert.equal(resolveActionValue({ type: "phone", value: "" }, card), "03-5551234");
    assert.equal(resolveActionValue({ type: "whatsapp", value: "" }, card), "0501234567");
    assert.equal(resolveActionValue({ type: "email", value: "" }, card), "info@example.co.il");
    assert.equal(resolveActionValue({ type: "waze", value: "" }, card), "אלנבי 42, תל אביב");
  });

  it("ערך שהוגדר ידנית מנצח", () => {
    assert.equal(resolveActionValue({ type: "phone", value: "02-9998888" }, card), "02-9998888");
  });

  it("צעד השחזור: שינוי הטלפון בכרטיס משנה את הפעולה", () => {
    const before = resolveActionValue({ type: "phone", value: "" }, card);
    const after = resolveActionValue({ type: "phone", value: "" }, { ...card, phone: "04-1112222" });
    assert.notEqual(before, after, "שינוי בפרטי הכרטיס חייב להשתקף בפעולה");
    assert.equal(after, "04-1112222");
  });

  it("וואטסאפ נופל לטלפון כשאין מספר ייעודי", () => {
    assert.equal(resolveActionValue({ type: "whatsapp", value: "" }, { ...card, whatsapp: "" }), "03-5551234");
  });

  it("פעולה בלי יעד תקין אינה שמישה", () => {
    assert.equal(isActionUsable({ type: "phone", value: "" }, { ...card, phone: "" }), false);
    assert.equal(isActionUsable({ type: "whatsapp", value: "abc" }, { ...card, whatsapp: "", phone: "" }), false);
    assert.equal(isActionUsable({ type: "save_contact", value: "" }, card), true, "שמירת איש קשר תמיד זמינה");
  });
});

describe("QA-027 — vCard מסונכרן עם הכרטיס", () => {
  const emptyVCard = {
    fullName: "", firstName: "", lastName: "", organization: "", title: "",
    phone: "", phoneSecondary: "", email: "", website: "", address: "", note: "",
    includePhoto: false,
  };
  const card = {
    ownerName: "דן בן יעקב", businessName: "מאפיית לחם הארץ", roleTitle: "בעלים ואופה",
    phone: "03-5551234", whatsapp: "0501234567", email: "dan@example.co.il",
    website: "https://naimly.co.il", address: "אלנבי 42",
    vcard: emptyVCard,
  };

  it("צעד השחזור: שדות ריקים מתמלאים מהכרטיס", () => {
    const vcard = resolveVCard(card as never);
    assert.equal(vcard.fullName, "דן בן יעקב");
    assert.equal(vcard.firstName, "דן");
    assert.equal(vcard.lastName, "בן יעקב");
    assert.equal(vcard.organization, "מאפיית לחם הארץ");
    assert.equal(vcard.title, "בעלים ואופה");
    assert.equal(vcard.phone, "03-5551234", "הנייד לא היה אמור להישאר ריק");
    assert.equal(vcard.email, "dan@example.co.il", "האימייל לא היה אמור להישאר ריק");
  });

  it("ערך שהוגדר ידנית ב-vCard נשמר", () => {
    const manual = { ...card, vcard: { ...emptyVCard, organization: "שם אחר בכוונה" } };
    assert.equal(resolveVCard(manual as never).organization, "שם אחר בכוונה");
  });

  it("אזהרה לפני פרסום כשחסרים פרטים ל-vCard", () => {
    const bare = { ...card, phone: "", whatsapp: "", email: "" };
    const missing = missingVCardFields(bare as never);
    assert.ok(missing.includes("טלפון"));
    assert.ok(missing.includes("אימייל"));
    assert.equal(missingVCardFields(card as never).length, 0);
  });
});
