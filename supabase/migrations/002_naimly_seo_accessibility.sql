alter table public.cards add column if not exists allow_indexing boolean not null default true;
alter table public.cards add column if not exists social_image_url text not null default '';
alter table public.cards add column if not exists area_served text not null default '';
alter table public.cards add column if not exists cover_alt text not null default '';
alter table public.cards add column if not exists logo_alt text not null default '';
alter table public.cards add column if not exists avatar_alt text not null default '';

alter table public.card_events drop constraint if exists card_events_event_type_check;
alter table public.card_events add constraint card_events_event_type_check check (
  event_type in ('view', 'qr_scan', 'phone', 'whatsapp', 'whatsapp_primary', 'email', 'contact_save', 'map', 'waze', 'google_maps', 'website', 'share', 'social', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'calendar', 'button', 'video', 'file', 'lead')
);
