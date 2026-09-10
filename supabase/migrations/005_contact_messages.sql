-- פניות מטופס "צרו קשר" באתר.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('improvement', 'sales', 'training', 'technical', 'general')),
  topic_label text not null default '',
  priority text not null default 'low' check (priority in ('low', 'normal', 'high')),
  name text not null,
  email text not null,
  phone text not null default '',
  message text not null,
  -- מזהה המשתמש כשהפנייה נשלחה ממשתמש מחובר. אחרת null.
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  admin_note text not null default '',
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx on public.contact_messages(status, priority desc, created_at desc);
create index if not exists contact_messages_user_idx on public.contact_messages(user_id, created_at desc);

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;

-- כתיבה מתבצעת רק דרך ה-API עם service-role. קריאה: המנהל, או השולח את שלו.
drop policy if exists "contact_messages_read" on public.contact_messages;
create policy "contact_messages_read" on public.contact_messages
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
