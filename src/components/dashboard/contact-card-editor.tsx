"use client";

import { Download, UserPlus } from "lucide-react";
import type { CardAddress, CardData, VCardSettings } from "@/lib/types";
import { Field, FormAlert, inputClass } from "@/components/ui/field";
import { AddressEditor } from "@/components/dashboard/address-editor";
import { formatAddress } from "@/lib/address";
import { resolveVCard } from "@/lib/contact-source";

/**
 * עורך כרטיס איש הקשר (vCard) והכתובת המובנית.
 *
 * הלקוח לא בונה ולא מעלה קובץ vCard — הוא ממלא שדות, והמערכת מייצרת את
 * הקובץ. שדה שנשאר ריק אינו נכנס לקובץ, כך שלא נחשף מידע שלא נבחר לפרסום.
 */
export function ContactCardEditor({
  card,
  slug,
  isPublished,
  onVCardChange,
  onAddressChange,
}: {
  card: CardData;
  slug: string;
  isPublished: boolean;
  onVCardChange: (patch: Partial<VCardSettings>) => void;
  onAddressChange: (patch: Partial<CardAddress>) => void;
}) {
  const vcard = card.vcard;
  // הניווט מופעל כשיש פעולה מהירה או כפתור חכם שמוביל למיקום.
  const navigationEnabled =
    card.quickActions.some((action) => action.type === "waze" || action.type === "google_maps")
    || card.smartButtons.some((button) => button.action === "waze" || button.action === "google_maps");

  /*
   * הבדיקה חייבת לעבור דרך resolveVCard — בדיוק כמו missingVCardFields
   * וכמו /api/vcard/[slug] — ולא לבדוק רק את שדות הטאב הזה. בעל כרטיס
   * עם שם מלא בכרטיס אך בלי שדה vCard ידני ראה "חסר שם" ואי-אפשר
   * להוריד, אף שהקובץ שבאמת נוצר תקין לגמרי (נגזר משם הכרטיס).
   */
  const resolved = resolveVCard(card);
  const hasName = Boolean(resolved.fullName.trim() || resolved.firstName.trim() || resolved.lastName.trim());
  const displayName = resolved.fullName.trim() || [resolved.firstName, resolved.lastName].filter(Boolean).join(" ");

  return (
    <div className="grid gap-8">
      {/* ── שם ותפקיד ─────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1efff] text-[#6d4aff]">
            <UserPlus size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold">כרטיס איש קשר</h2>
            <p className="mt-0.5 text-sm text-[#748196]">
              כשהמבקר לוחץ על ״שמור אותי״, הטלפון מציע להוסיף את הפרטים האלה לאנשי הקשר.
            </p>
          </div>
        </div>

        {!hasName && (
          <FormAlert tone="error" title="חסר שם" className="mb-4">
            יש להזין שם פרטי, שם משפחה או שם לתצוגה — בלעדיהם לא ניתן ליצור כרטיס איש קשר.
          </FormAlert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="שם פרטי"
            required={!hasName}
            optional={hasName && !vcard.firstName.trim()}
            hint={!vcard.firstName.trim() && resolved.firstName ? `כשריק — נגזר משם בעל הכרטיס: ${resolved.firstName}` : undefined}
          >
            {(field) => (
              <input
                {...field}
                data-field="firstName"
                className={inputClass(!hasName)}
                value={vcard.firstName}
                onChange={(event) => onVCardChange({ firstName: event.target.value })}
                placeholder={resolved.firstName || "נועה"}
                maxLength={60}
                autoComplete="given-name"
              />
            )}
          </Field>

          <Field label="שם משפחה" optional>
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                value={vcard.lastName}
                onChange={(event) => onVCardChange({ lastName: event.target.value })}
                placeholder={resolved.lastName || "כהן"}
                maxLength={60}
                autoComplete="family-name"
              />
            )}
          </Field>

          <Field
            label="שם לתצוגה"
            optional
            hint={displayName ? `יופיע באנשי הקשר כ: ${displayName}` : "כשריק — מורכב משם פרטי ומשפחה"}
            className="sm:col-span-2"
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                value={vcard.fullName}
                onChange={(event) => onVCardChange({ fullName: event.target.value })}
                placeholder="נועה כהן — מעצבת"
                maxLength={100}
              />
            )}
          </Field>

          <Field
            label="שם העסק"
            optional
            hint={!vcard.organization.trim() && resolved.organization ? `כשריק — נגזר משם העסק בכרטיס: ${resolved.organization}` : undefined}
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                value={vcard.organization}
                onChange={(event) => onVCardChange({ organization: event.target.value })}
                placeholder={resolved.organization}
                maxLength={100}
                autoComplete="organization"
              />
            )}
          </Field>

          <Field label="תפקיד" optional>
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                value={vcard.title}
                onChange={(event) => onVCardChange({ title: event.target.value })}
                maxLength={100}
                autoComplete="organization-title"
              />
            )}
          </Field>
        </div>
      </section>

      {/* ── דרכי התקשרות ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 font-extrabold">דרכי התקשרות</h2>
        <p className="mb-4 text-sm text-[#748196]">שדה שיישאר ריק לא ייכנס לכרטיס איש הקשר.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="נייד"
            optional
            hint={!vcard.phone.trim() && resolved.phone ? `כשריק — נגזר מפרטי הקשר של הכרטיס: ${resolved.phone}` : "הטלפון הראשי באיש הקשר"}
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={vcard.phone}
                onChange={(event) => onVCardChange({ phone: event.target.value })}
                placeholder={resolved.phone || "050-1234567"}
                maxLength={30}
              />
            )}
          </Field>

          <Field label="טלפון נוסף" optional hint="קווי או משרד">
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={vcard.phoneSecondary}
                onChange={(event) => onVCardChange({ phoneSecondary: event.target.value })}
                placeholder="03-7654321"
                maxLength={30}
              />
            )}
          </Field>

          <Field
            label="אימייל"
            optional
            hint={!vcard.email.trim() && resolved.email ? `כשריק — נגזר מפרטי הקשר של הכרטיס: ${resolved.email}` : undefined}
          >
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                type="email"
                dir="ltr"
                inputMode="email"
                value={vcard.email}
                onChange={(event) => onVCardChange({ email: event.target.value })}
                placeholder={resolved.email || "name@example.co.il"}
                maxLength={160}
              />
            )}
          </Field>

          <Field label="אתר" optional>
            {(field) => (
              <input
                {...field}
                className={inputClass(false)}
                type="url"
                dir="ltr"
                value={vcard.website}
                onChange={(event) => onVCardChange({ website: event.target.value })}
                placeholder="https://example.co.il"
                maxLength={2000}
              />
            )}
          </Field>

          <Field
            label="הערה שתישמר"
            optional
            count={vcard.note.length}
            maxLength={300}
            className="sm:col-span-2"
          >
            {(field) => (
              <textarea
                {...field}
                className={inputClass(false, "field-textarea")}
                value={vcard.note}
                onChange={(event) => onVCardChange({ note: event.target.value })}
                placeholder="זמינה בימים א׳–ה׳, 9:00–18:00"
                maxLength={300}
              />
            )}
          </Field>
        </div>

        <label className="mt-4 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4.5 w-4.5"
            checked={vcard.includePhoto}
            onChange={(event) => onVCardChange({ includePhoto: event.target.checked })}
          />
          <span>
            לצרף את הלוגו או תמונת הפרופיל לאיש הקשר
            <span className="mt-0.5 block text-xs text-[#78859a]">
              נתמך ברוב המכשירים. כשאין תמונה בכרטיס — מתעלמים מההגדרה.
            </span>
          </span>
        </label>
      </section>

      {/* ── כתובת מובנית ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 font-extrabold">כתובת וניווט</h2>
        <p className="mb-4 text-sm text-[#748196]">
          לא צריך להדביק קישורים. ממלאים את השדות והמערכת בונה את הניווט ל‑Waze ול‑Google Maps.
        </p>
        <AddressEditor
          value={card.cardAddress}
          onChange={onAddressChange}
          navigationEnabled={navigationEnabled}
        />
      </section>

      {/* ── בדיקת הקובץ ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#dfe4ec] bg-[#fbfcfe] p-4">
        <h2 className="font-extrabold">בדיקת כרטיס איש הקשר</h2>
        <p className="mt-1 text-sm leading-6 text-[#68758a]">
          {isPublished
            ? "אפשר להוריד את הקובץ ולוודא שהפרטים נשמרים נכון במכשיר."
            : "אחרי פרסום הכרטיס אפשר להוריד את הקובץ ולבדוק אותו במכשיר."}
        </p>
        {formatAddress(card.cardAddress) && (
          <p className="mt-2 text-xs text-[#78859a]">הכתובת שתישמר: {formatAddress(card.cardAddress)}</p>
        )}
        <a
          href={`/api/vcard/${slug}`}
          className="button-secondary mt-4 min-h-12"
          aria-disabled={!isPublished}
          onClick={(event) => { if (!isPublished) event.preventDefault(); }}
        >
          <Download size={16} aria-hidden="true" />הורדת הקובץ לבדיקה
        </a>
      </section>
    </div>
  );
}
