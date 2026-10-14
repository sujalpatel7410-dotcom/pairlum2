-- ============================================================================
-- Pairlum backend schema (Supabase / Postgres)
--
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run. Safe to re-run (uses IF NOT EXISTS / OR
-- REPLACE / ON CONFLICT DO NOTHING throughout).
--
-- Design note: app.js (the dashboard) keeps ALL of a couple's data — Shared
-- Day, Letters, Our Story, I Need You, mood, Our DNA, everything — as one
-- JSON record per space (see readShared/writeShared in app.js). Rather than
-- normalizing ~25 feature areas into their own tables (which would mean
-- touching ~200 call sites across a 17,000-line file), this schema keeps
-- that same shape: one `spaces.data jsonb` document per couple, guarded by
-- row-level security and a `rev` column for optimistic-concurrency writes.
-- Realtime + Storage cover the rest (live sync between two devices, and
-- actual photo/video/voice bytes).
--
-- After running this, set supabaseUrl / supabaseAnonKey in pairlum-config.js
-- (Dashboard → Project Settings → API) and read SETUP.md for the rest.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- One row per couple space. `data` is the exact shape app.js's readShared()
-- already expects (v, moments[], notes[], letters[], ..., membership{}).
-- ---------------------------------------------------------------------------
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  rev integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly two members per space: role 'a' (the creator) and 'b' (whoever
-- redeems the invite). A user belongs to at most one ACTIVE space at a time
-- (see is_active_member below) — 'status' lets leaving/disconnecting free an
-- account to pair again later without deleting the historical row, so the
-- uniqueness guarantee is a PARTIAL index (active rows only), not a plain
-- unique(user_id) — a user may accumulate multiple left/disconnected rows
-- across past spaces, just never more than one active one at a time.
create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('a','b')),
  status text not null default 'active' check (status in ('active','left','disconnected')),
  joined_at timestamptz not null default now(),
  primary key (space_id, role)
);

-- Migration for a project that already ran an earlier version of this file
-- (plain CREATE TABLE IF NOT EXISTS above is a no-op against an existing
-- table, so the new column/constraint/index need their own idempotent steps).
do $$ begin
  alter table public.space_members add column status text not null default 'active';
exception when duplicate_column then null; end $$;
do $$ begin
  alter table public.space_members add constraint space_members_status_check check (status in ('active','left','disconnected'));
exception when duplicate_object then null; end $$;
-- The old plain unique(user_id) (one space ever, period) is replaced by the
-- partial index below (one ACTIVE space at a time) so leaving/disconnecting
-- can actually free an account to pair again.
alter table public.space_members drop constraint if exists space_members_user_id_key;

create index if not exists space_members_space_id_idx on public.space_members(space_id);
create unique index if not exists space_members_one_active_user_idx on public.space_members(user_id) where status = 'active';

-- Phase 2: the 6-character invite-code system was replaced by email-based
-- pairing requests (below) — drop it. Pre-launch, throwaway-account project,
-- nothing worth preserving (dropping the table also drops its policy).
drop function if exists public.create_invite(uuid);
drop function if exists public.redeem_invite(text);
drop function if exists public.revoke_invite(uuid);
drop table if exists public.invites cascade;

-- One row per "A wants to pair with B" request, identified by B's email
-- (clients can't query auth.users directly, so from_email/to_email are
-- captured server-side at insert time — see send_pairing_request below).
create table if not exists public.pairing_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  from_email text not null,
  to_user uuid not null references auth.users(id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists pairing_requests_to_user_idx on public.pairing_requests(to_user) where status = 'pending';
create index if not exists pairing_requests_from_user_idx on public.pairing_requests(from_user) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Helper: is the signed-in user a member of this space? (security definer so
-- RLS policies on other tables can call it without recursive-policy issues.)
-- ---------------------------------------------------------------------------
create or replace function public.is_space_member(target_space uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid()
  );
$$;

-- Member AND currently active (not left/disconnected) — used to gate writes
-- and invites, where "a member of this space" alone isn't enough: someone
-- who stepped away or disconnected can still read history, but not write.
create or replace function public.is_active_member(target_space uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid() and status = 'active'
  );
$$;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.pairing_requests enable row level security;

drop policy if exists "members can read their space" on public.spaces;
create policy "members can read their space" on public.spaces
  for select using (public.is_space_member(id));

drop policy if exists "members can update their space" on public.spaces;
create policy "members can update their space" on public.spaces
  for update using (public.is_space_member(id));
-- No insert policy: spaces are only ever created via create_space() below
-- (security definer), so a client can never insert an orphan space row.

drop policy if exists "members can read their membership rows" on public.space_members;
create policy "members can read their membership rows" on public.space_members
  for select using (user_id = auth.uid() or public.is_space_member(space_id));

drop policy if exists "users can read their own pairing requests" on public.pairing_requests;
create policy "users can read their own pairing requests" on public.pairing_requests
  for select using (auth.uid() = from_user or auth.uid() = to_user);
-- No insert/update/delete policy: requests are only ever created, accepted,
-- declined or cancelled via the RPCs below (security definer), so a client
-- can never forge a request, nor silently flip another account's response.

-- ---------------------------------------------------------------------------
-- RPCs — the only way clients create a space, send/accept a pairing request,
-- or write data.
-- ---------------------------------------------------------------------------

-- Create a new space and make the caller its 'a' member. `seed` should be a
-- COMPLETE empty record matching app.js's shape (see pairlum-backend.js's
-- EMPTY_SPACE constant) so a fresh couple never sees demo content.
create or replace function public.create_space(seed jsonb)
returns public.spaces language plpgsql security definer as $$
declare
  new_space public.spaces;
begin
  if exists(select 1 from public.space_members where user_id = auth.uid() and status = 'active') then
    raise exception 'you already belong to a space';
  end if;
  insert into public.spaces(data) values (coalesce(seed, '{}'::jsonb)) returning * into new_space;
  insert into public.space_members(space_id, user_id, role) values (new_space.id, auth.uid(), 'a');
  return new_space;
end;
$$;

-- Send a pairing request to a partner identified by email. Requires the
-- caller to already be an active member of target_space (the client always
-- calls create_space first if it doesn't have one yet — see pairlum-sync.js's
-- ensureSpace) and for that space to still have room for a 'b' member.
-- Looks the email up in auth.users (clients can't query that table directly)
-- and denormalizes both emails onto the row so the recipient's bell can show
-- "who" without ever needing to read auth.users itself.
create or replace function public.send_pairing_request(target_space uuid, to_email text)
returns public.pairing_requests language plpgsql security definer as $$
declare
  target_id uuid;
  target_email text;
  caller_email text;
  result public.pairing_requests;
begin
  if not public.is_active_member(target_space) then
    raise exception 'not an active member of this space';
  end if;
  if exists(select 1 from public.space_members where space_id = target_space and role = 'b') then
    raise exception 'this space already has two members';
  end if;
  select email into caller_email from auth.users where id = auth.uid();
  select id, email into target_id, target_email from auth.users where lower(email) = lower(trim(to_email)) limit 1;
  if target_id is null then
    raise exception 'no Pairlum account found with that email';
  end if;
  if target_id = auth.uid() then
    raise exception 'you can''t send a pairing request to yourself';
  end if;
  if exists(select 1 from public.space_members where user_id = target_id and status = 'active') then
    raise exception 'that person is already paired with someone';
  end if;
  -- Replace any previous pending request from this space so retrying with a
  -- different (e.g. mistyped) email doesn't leave stale duplicates behind.
  update public.pairing_requests set status = 'cancelled', responded_at = now()
    where space_id = target_space and status = 'pending';
  insert into public.pairing_requests(space_id, from_user, from_email, to_user, to_email)
    values (target_space, auth.uid(), caller_email, target_id, target_email)
    returning * into result;
  return result;
end;
$$;

-- Sender cancels their own still-pending request (the "Cancel request" button).
create or replace function public.cancel_pairing_request(request_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.pairing_requests set status = 'cancelled', responded_at = now()
    where id = request_id and from_user = auth.uid() and status = 'pending';
  if not found then
    raise exception 'that request is no longer available';
  end if;
end;
$$;

-- Recipient declines a pending request.
create or replace function public.decline_pairing_request(request_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.pairing_requests set status = 'declined', responded_at = now()
    where id = request_id and to_user = auth.uid() and status = 'pending';
  if not found then
    raise exception 'that request is no longer available';
  end if;
end;
$$;

-- Recipient accepts: joins the sender's space as role 'b'. Returns the space row.
create or replace function public.accept_pairing_request(request_id uuid)
returns public.spaces language plpgsql security definer as $$
declare
  req public.pairing_requests;
  result public.spaces;
begin
  select * into req from public.pairing_requests where id = request_id and to_user = auth.uid() and status = 'pending';
  if req is null then
    raise exception 'that request is no longer available';
  end if;
  if exists(select 1 from public.space_members where user_id = auth.uid() and status = 'active') then
    raise exception 'you already belong to a space';
  end if;
  if exists(select 1 from public.space_members where space_id = req.space_id and role = 'b') then
    raise exception 'this space already has two members';
  end if;
  insert into public.space_members(space_id, user_id, role) values (req.space_id, auth.uid(), 'b');
  update public.pairing_requests set status = 'accepted', responded_at = now() where id = req.id;
  -- Clean up any other stale pending requests involving either party, so
  -- duplicates don't linger in either account's bell after this pairing.
  update public.pairing_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and id <> req.id
      and (from_user in (req.from_user, req.to_user) or to_user in (req.from_user, req.to_user));
  select * into result from public.spaces where id = req.space_id;
  return result;
end;
$$;

-- Optimistic-concurrency write: succeeds only if `rev` still matches what the
-- caller last read. Returns the updated row, or NULL (not an error) on a
-- conflict — the caller re-fetches the latest row and retries once.
create or replace function public.write_space_data(target_space uuid, new_data jsonb, expected_rev integer)
returns public.spaces language plpgsql security definer as $$
declare
  result public.spaces;
begin
  if not public.is_active_member(target_space) then
    raise exception 'not an active member of this space — rejoin before making changes';
  end if;
  update public.spaces
    set data = new_data, rev = rev + 1, updated_at = now()
    where id = target_space and rev = expected_rev
    returning * into result;
  return result;
end;
$$;

-- Step away without ending the connection: pauses writes for the CALLER only
-- (write_space_data requires is_active_member) until the same account calls
-- rejoin_space. The other partner's row, and their ability to write, is
-- completely unaffected — matches the app's own "Leave" copy ("[partner]
-- keeps this space exactly as it is — nothing changes on their side").
create or replace function public.leave_space(target_space uuid)
returns void language plpgsql security definer as $$
begin
  update public.space_members set status = 'left'
    where space_id = target_space and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not an active member of this space';
  end if;
end;
$$;

-- Undo leave_space for the same account. Does nothing to a 'disconnected'
-- row — disconnecting is terminal, there is no rejoin from it.
create or replace function public.rejoin_space(target_space uuid)
returns void language plpgsql security definer as $$
begin
  update public.space_members set status = 'active'
    where space_id = target_space and user_id = auth.uid() and status = 'left';
  if not found then
    raise exception 'nothing to rejoin — you are not marked as having left this space';
  end if;
end;
$$;

-- Permanently ends the pairing: BOTH members' rows move to 'disconnected'.
-- The space row and its data are kept exactly as they are (nothing erased),
-- but write_space_data refuses forever after this, and — because the
-- uniqueness guarantee above only applies to 'active' rows — both accounts
-- are immediately free to create or join a different space.
create or replace function public.disconnect_space(target_space uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_space_member(target_space) then
    raise exception 'not a member of this space';
  end if;
  update public.space_members set status = 'disconnected'
    where space_id = target_space;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, update on public.spaces to authenticated;
grant select on public.space_members to authenticated;
grant select on public.pairing_requests to authenticated;
grant execute on function public.create_space(jsonb) to authenticated;
grant execute on function public.send_pairing_request(uuid, text) to authenticated;
grant execute on function public.cancel_pairing_request(uuid) to authenticated;
grant execute on function public.decline_pairing_request(uuid) to authenticated;
grant execute on function public.accept_pairing_request(uuid) to authenticated;
grant execute on function public.write_space_data(uuid, jsonb, integer) to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.rejoin_space(uuid) to authenticated;
grant execute on function public.disconnect_space(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: let a client subscribe to changes on its own space row, to its
-- own space_members rows (so a sender's device learns the moment the other
-- partner accepts, without polling), and to its own pairing_requests rows
-- (so a brand-new, spaceless account can see an incoming request live).
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.spaces;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.space_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pairing_requests;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for photo/video/voice bytes. One object per media id, at
-- path "<space_id>/<media_id>" — matches app.js's mediaWriteKey()/mediaKeys()
-- id scheme (generation-prefixed ids are still a single path segment, e.g.
-- "<space_id>/g3:rec_abc123").
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('media', 'media', false)
  on conflict (id) do nothing;

drop policy if exists "space members can read their media" on storage.objects;
create policy "space members can read their media" on storage.objects
  for select using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid));

drop policy if exists "space members can upload their media" on storage.objects;
create policy "space members can upload their media" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid));

drop policy if exists "space members can overwrite their media" on storage.objects;
create policy "space members can overwrite their media" on storage.objects
  for update using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid));

drop policy if exists "space members can delete their media" on storage.objects;
create policy "space members can delete their media" on storage.objects
  for delete using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid));
