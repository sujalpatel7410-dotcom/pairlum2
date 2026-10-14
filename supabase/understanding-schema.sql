-- ============================================================================
-- Pairlum "understanding" service — voice write-ups (transcription + a
-- title/feeling/topics extraction) for recordings people choose to send.
--
-- Run this AFTER schema.sql, the same way (SQL Editor → New query → paste →
-- Run). This table is touched only by the pairlum-understand Edge Function
-- (using its service-role key) — no RLS policies are granted to clients, so
-- there is no direct table access to lock down beyond "none at all".
-- ============================================================================

create table if not exists public.recordings (
  id text primary key,                 -- the client's own recording id (app.js's recId)
  space_id uuid not null references public.spaces(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  transcript text,
  title text,
  feeling text,
  language text,
  topics jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recordings_space_id_idx on public.recordings(space_id);

alter table public.recordings enable row level security;
-- Intentionally no policies: only the Edge Function (service role) ever
-- reads/writes this table. Clients talk to it only through the function's
-- HTTP endpoint, never through PostgREST directly.
