-- ספריית רקעים מורחבת.
--
-- המגבלה המקורית התירה שישה ערכים בלבד, ולכן כל רקע חדש היה נדחה על ידי
-- מסד הנתונים. במקום רשימה קשיחה ב-check, הרקעים עוברים לטבלת lookup —
-- כך אפשר להוסיף רקעים בלי מיגרציה נוספת, וההגנה נשמרת דרך מפתח זר.

create table if not exists public.card_backgrounds (
  id text primary key,
  name text not null,
  category text not null check (category in (
    'professional', 'minimal', 'luxury', 'colorful', 'dark',
    'light', 'tech', 'creative', 'gradient', 'geometric'
  )),
  -- 'dark' = טקסט כהה מעל הרקע, 'light' = טקסט בהיר.
  foreground text not null default 'dark' check (foreground in ('dark', 'light')),
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

alter table public.card_backgrounds enable row level security;

drop policy if exists "card_backgrounds_public_read" on public.card_backgrounds;
create policy "card_backgrounds_public_read" on public.card_backgrounds
  for select to anon, authenticated using (true);

-- הרקעים עצמם נשמרים בקוד (src/lib/backgrounds.ts) כדי שה-CSS יהיה
-- זהה בין התצוגה המקדימה לכרטיס המפורסם. הטבלה מחזיקה רק את המזהים,
-- לצורך אימות ברמת מסד הנתונים.
insert into public.card_backgrounds (id, name, category, foreground, sort_order) values
  ('aurora', 'אורורה', 'professional', 'dark', 1),
  ('corporate-slate', 'אפור עסקי', 'professional', 'dark', 2),
  ('trust-blue', 'כחול אמון', 'professional', 'dark', 3),
  ('consultant-sand', 'חול יועץ', 'professional', 'dark', 4),
  ('legal-navy', 'נייבי משפטי', 'professional', 'light', 5),
  ('medical-mint', 'מנטה רפואי', 'professional', 'dark', 6),
  ('minimal', 'מינימלי', 'minimal', 'dark', 7),
  ('pure-white', 'לבן נקי', 'minimal', 'dark', 8),
  ('paper', 'נייר', 'minimal', 'dark', 9),
  ('fog', 'ערפל', 'minimal', 'dark', 10),
  ('linen', 'פשתן', 'minimal', 'dark', 11),
  ('whisper-grey', 'אפור לחישה', 'minimal', 'dark', 12),
  ('black-gold', 'שחור וזהב', 'luxury', 'light', 13),
  ('champagne', 'שמפניה', 'luxury', 'dark', 14),
  ('royal-purple', 'סגול מלכותי', 'luxury', 'light', 15),
  ('emerald-velvet', 'קטיפה אמרלד', 'luxury', 'light', 16),
  ('rose-marble', 'שיש רוזה', 'luxury', 'dark', 17),
  ('obsidian', 'אובסידיאן', 'luxury', 'light', 18),
  ('sunset', 'שקיעה', 'colorful', 'dark', 19),
  ('citrus', 'הדרים', 'colorful', 'dark', 20),
  ('tropical', 'טרופי', 'colorful', 'dark', 21),
  ('candy', 'סוכריה', 'colorful', 'dark', 22),
  ('rainbow-soft', 'קשת רכה', 'colorful', 'dark', 23),
  ('coral-reef', 'שונית אלמוגים', 'colorful', 'dark', 24),
  ('midnight', 'חצות', 'dark', 'light', 25),
  ('ocean', 'אוקיינוס', 'dark', 'light', 26),
  ('charcoal', 'פחם', 'dark', 'light', 27),
  ('deep-forest', 'יער עמוק', 'dark', 'light', 28),
  ('wine', 'יין', 'dark', 'light', 29),
  ('space', 'חלל', 'dark', 'light', 30),
  ('daylight', 'אור יום', 'light', 'dark', 31),
  ('sky', 'שמיים', 'light', 'dark', 32),
  ('peach-soft', 'אפרסק רך', 'light', 'dark', 33),
  ('mint-light', 'מנטה בהיר', 'light', 'dark', 34),
  ('lavender-light', 'לבנדר בהיר', 'light', 'dark', 35),
  ('butter', 'חמאה', 'light', 'dark', 36),
  ('circuit', 'מעגלים', 'tech', 'light', 37),
  ('neon-grid', 'רשת ניאון', 'tech', 'light', 38),
  ('data-blue', 'כחול דאטה', 'tech', 'light', 39),
  ('terminal', 'טרמינל', 'tech', 'light', 40),
  ('chrome', 'כרום', 'tech', 'dark', 41),
  ('hologram', 'הולוגרמה', 'tech', 'dark', 42),
  ('watercolor', 'צבעי מים', 'creative', 'dark', 43),
  ('ink-splash', 'כתם דיו', 'creative', 'light', 44),
  ('sunrise-studio', 'סטודיו זריחה', 'creative', 'dark', 45),
  ('pastel-dream', 'חלום פסטל', 'creative', 'dark', 46),
  ('duotone-violet', 'דואוטון סגול', 'creative', 'light', 47),
  ('canvas-texture', 'מרקם בד', 'creative', 'dark', 48),
  ('soft-violet', 'סגול רך', 'gradient', 'dark', 49),
  ('soft-teal', 'טורקיז רך', 'gradient', 'dark', 50),
  ('soft-rose', 'רוזה רך', 'gradient', 'dark', 51),
  ('soft-amber', 'אמבר רך', 'gradient', 'dark', 52),
  ('aurora-mesh', 'רשת אורורה', 'gradient', 'dark', 53),
  ('twilight-fade', 'דמדומים', 'gradient', 'light', 54),
  ('diagonal-stripes', 'פסים אלכסוניים', 'geometric', 'dark', 55),
  ('dot-grid', 'רשת נקודות', 'geometric', 'dark', 56),
  ('blueprint', 'שרטוט', 'geometric', 'dark', 57),
  ('hex-mesh', 'משושים', 'geometric', 'dark', 58),
  ('arc-layers', 'שכבות קשת', 'geometric', 'light', 59),
  ('checker-soft', 'משבצות רכות', 'geometric', 'dark', 60)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  foreground = excluded.foreground,
  sort_order = excluded.sort_order,
  is_active = true;

-- המגבלה הקשיחה מוסרת ומוחלפת במפתח זר לטבלת הרקעים.
alter table public.cards drop constraint if exists cards_background_preset_check;
alter table public.cards drop constraint if exists cards_background_preset_fkey;
alter table public.cards
  add constraint cards_background_preset_fkey
  foreign key (background_preset) references public.card_backgrounds(id)
  on update cascade on delete set default;

create index if not exists cards_background_idx on public.cards(background_preset);
