-- כתובת מובנית ו-vCard מורחב.
--
-- הכתובת עוברת מטקסט חופשי לשדות, כדי שהמערכת תבנה את קישורי Waze
-- ו-Google Maps בעצמה. עמודת address הקיימת נשמרת לתאימות ולא נמחקת.

alter table public.cards add column if not exists card_address jsonb not null default '{}'::jsonb;

comment on column public.cards.card_address is
  'כתובת מובנית: country, city, street, houseNumber, postalCode, latitude, longitude, note';
comment on column public.cards.address is
  'כתובת טקסט חופשי. נשמרת לתאימות; המקור הקנוני הוא card_address';

-- אינדקס לחיפוש עתידי לפי עיר.
create index if not exists cards_address_city_idx on public.cards ((card_address ->> 'city'));

/*
 * מיגרציה רכה: לכרטיסים קיימים שיש להם כתובת טקסט אך אין כתובת מובנית,
 * ממלאים את העיר והרחוב במאמץ מיטבי. הפירוק המדויק נעשה בקוד
 * (parseFreeTextAddress); כאן רק מבטיחים שהעיר לא תישאר ריקה.
 */
update public.cards
set card_address = jsonb_build_object(
      'country', 'ישראל',
      'city', coalesce(nullif(trim(split_part(address, ',', 2)), ''), ''),
      'street', coalesce(nullif(trim(split_part(address, ',', 1)), ''), ''),
      'houseNumber', '',
      'postalCode', '',
      'latitude', '',
      'longitude', '',
      'note', ''
    )
where coalesce(address, '') <> ''
  and (card_address is null or card_address = '{}'::jsonb);
