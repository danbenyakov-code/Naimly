-- טבלת מעקב המיגרציות נוצרת על ידי סקריפט ההרצה, מחוץ למיגרציות עצמן,
-- ולכן נשארה בלי RLS. היא בסכמה public ולכן נחשפת דרך PostgREST.
-- אין בה סוד, אבל היא מסגירה את מבנה המערכת ואת קצב הפיתוח.

create table if not exists public.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now(),
  checksum text not null default ''
);

alter table public.schema_migrations enable row level security;

-- ללא מדיניות כלל: רק service-role ניגש. זו התנהגות מכוונת.
revoke all on public.schema_migrations from anon, authenticated;
