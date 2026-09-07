"use client";

import { ExternalLink, Map, MapPin } from "lucide-react";
import type { CardAddress } from "@/lib/types";
import { formatAddress, googleMapsUrl, hasNavigableAddress, missingAddressFields, parseCoordinates, wazeUrl } from "@/lib/address";
import { Field, FormAlert, inputClass } from "@/components/ui/field";

/**
 * עורך כתובת מובנית. הלקוח ממלא שדות — לא כתובות URL — והמערכת בונה את
 * קישורי הניווט. הקישורים מוצגים לבדיקה לפני הפרסום.
 */
export function AddressEditor({
  value,
  onChange,
  /** האם פעולות הניווט מופעלות בכרטיס — אז הכתובת נדרשת. */
  navigationEnabled,
}: {
  value: CardAddress;
  onChange: (patch: Partial<CardAddress>) => void;
  navigationEnabled: boolean;
}) {
  const missing = missingAddressFields(value);
  const navigable = hasNavigableAddress(value);
  const formatted = formatAddress(value);
  const waze = wazeUrl(value);
  const maps = googleMapsUrl(value);
  const coordinates = parseCoordinates(value.latitude, value.longitude);

  const coordinateError =
    (value.latitude.trim() || value.longitude.trim()) && !coordinates
      ? "נדרשים שני שדות הנ.צ. יחד, בטווח תקין: רוחב ±90, אורך ±180."
      : undefined;

  return (
    <div className="grid gap-4">
      {/* שדות החובה מותנים בהפעלת פעולות ניווט */}
      {navigationEnabled && missing.length > 0 && (
        <FormAlert tone="error" title="לא ניתן ליצור קישור ניווט">
          הפעלת ניווט בכרטיס (Waze / Google Maps) מחייבת {missing.join(" ו")}.
          לחלופין אפשר להזין נ.צ. מדויקים.
        </FormAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="עיר" required={navigationEnabled} optional={!navigationEnabled}>
          {(field) => (
            <input
              {...field}
              data-field="city"
              className={inputClass(navigationEnabled && !value.city.trim())}
              value={value.city}
              onChange={(event) => onChange({ city: event.target.value })}
              placeholder="תל אביב"
              maxLength={80}
              autoComplete="address-level2"
            />
          )}
        </Field>

        <Field label="מדינה" optional>
          {(field) => (
            <input
              {...field}
              className={inputClass(false)}
              value={value.country}
              onChange={(event) => onChange({ country: event.target.value })}
              placeholder="ישראל"
              maxLength={60}
              autoComplete="country-name"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="רחוב" required={navigationEnabled} optional={!navigationEnabled}>
          {(field) => (
            <input
              {...field}
              data-field="street"
              className={inputClass(navigationEnabled && !value.street.trim())}
              value={value.street}
              onChange={(event) => onChange({ street: event.target.value })}
              placeholder="הרצל"
              maxLength={120}
              autoComplete="address-line1"
            />
          )}
        </Field>

        <Field label="מספר בית" optional>
          {(field) => (
            <input
              {...field}
              className={inputClass(false)}
              value={value.houseNumber}
              onChange={(event) => onChange({ houseNumber: event.target.value })}
              placeholder="25"
              maxLength={20}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="מיקוד" optional>
          {(field) => (
            <input
              {...field}
              className={inputClass(false)}
              value={value.postalCode}
              onChange={(event) => onChange({ postalCode: event.target.value })}
              placeholder="6713303"
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              autoComplete="postal-code"
            />
          )}
        </Field>

        <Field label="הערה לכתובת" optional hint="קומה, כניסה, הוראות הגעה">
          {(field) => (
            <input
              {...field}
              className={inputClass(false)}
              value={value.note}
              onChange={(event) => onChange({ note: event.target.value })}
              placeholder="קומה 3, כניסה ב׳"
              maxLength={120}
            />
          )}
        </Field>
      </div>

      {/* נ.צ. — עדיפים על כתובת טקסטואלית */}
      <fieldset className="rounded-2xl border border-[#e4e8f0] bg-[#fbfcfe] p-4">
        <legend className="px-1 text-sm font-semibold">נקודת ציון מדויקת (לא חובה)</legend>
        <p className="mb-3 text-xs leading-5 text-[#78859a]">
          כשמוזנים נ.צ., הניווט משתמש בהם במקום בכתובת — מדויק יותר, במיוחד באזורי תעשייה ובכניסות נסתרות.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="קו רוחב (Latitude)" optional error={coordinateError}>
            {(field) => (
              <input
                {...field}
                data-field="latitude"
                className={inputClass(Boolean(coordinateError))}
                value={value.latitude}
                onChange={(event) => onChange({ latitude: event.target.value })}
                placeholder="32.0733"
                dir="ltr"
                inputMode="decimal"
                maxLength={20}
              />
            )}
          </Field>
          <Field label="קו אורך (Longitude)" optional>
            {(field) => (
              <input
                {...field}
                className={inputClass(Boolean(coordinateError))}
                value={value.longitude}
                onChange={(event) => onChange({ longitude: event.target.value })}
                placeholder="34.7818"
                dir="ltr"
                inputMode="decimal"
                maxLength={20}
              />
            )}
          </Field>
        </div>
      </fieldset>

      {/* תצוגה מקדימה ובדיקת הקישורים */}
      <div className="rounded-2xl border border-[#dfe4ec] bg-white p-4">
        <p className="text-xs font-bold text-[#5f6d83]">כך תיראה הכתובת</p>
        <p className="mt-1 text-sm font-semibold">
          {formatted || <span className="font-normal text-[#8b96a8]">טרם הוזנה כתובת</span>}
        </p>
        {value.note && <p className="mt-0.5 text-xs text-[#78859a]">{value.note}</p>}
        {coordinates && (
          <p className="mt-1 text-xs text-[#08735f]" dir="ltr">
            GEO {coordinates.lat}, {coordinates.lon} — הניווט ישתמש בנ.צ.
          </p>
        )}

        {navigable ? (
          <>
            <p className="mt-3 text-xs text-[#78859a]">כדאי לבדוק את הקישורים לפני הפרסום:</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <a href={waze} target="_blank" rel="noopener noreferrer" className="button-secondary min-h-12 flex-1">
                <Map size={16} aria-hidden="true" />בדיקת Waze<ExternalLink size={13} aria-hidden="true" />
              </a>
              <a href={maps} target="_blank" rel="noopener noreferrer" className="button-secondary min-h-12 flex-1">
                <MapPin size={16} aria-hidden="true" />בדיקת Google Maps<ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-[#8b96a8]">
            {missing.length ? `להצגת קישורי ניווט נדרשים: ${missing.join(", ")}.` : "יש להשלים את הכתובת כדי לבדוק את הקישורים."}
          </p>
        )}
      </div>
    </div>
  );
}
