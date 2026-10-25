-- Run this entire file in the Supabase SQL editor. Safe to rerun.
-- Only server routes access these tables, with every query scoped to a guest owner.
create table if not exists public.looks (
  id uuid primary key,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.looks add column if not exists owner_id text;
alter table public.looks add column if not exists deleted_at timestamptz;
create index if not exists looks_owner_idx on public.looks (owner_id, created_at desc);
alter table public.looks enable row level security;

create table if not exists public.closet_uploads (
  id uuid primary key,
  owner_id text not null,
  storage_path text not null,
  kind text not null check (kind in ('garment', 'person')),
  name text not null,
  category text not null check (category in ('outer','upper_body','lower_body','full_body','shoes','auto')),
  owned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists closet_uploads_owner_idx on public.closet_uploads (owner_id, kind, created_at desc);
alter table public.closet_uploads enable row level security;
revoke all on public.looks, public.closet_uploads from anon, authenticated;
grant all on public.looks, public.closet_uploads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('looks', 'looks', false, 15728640, array['image/jpeg','image/png','image/webp']),
  ('closet', 'closet', false, 4194304, array['image/jpeg','image/png'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- No public policies. Server routes issue one-hour signed URLs for owned media.
-- Legacy looks with null owner_id remain private and are not auto-assigned.
