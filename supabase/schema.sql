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

-- Phase 2: the original 6-character invite-code system was replaced by
-- email-based pairing requests — drop it. (Historical; see git history if
-- the old create_invite/redeem_invite/revoke_invite shape is ever useful.)
drop function if exists public.create_invite(uuid);
drop function if exists public.redeem_invite(text);
drop function if exists public.revoke_invite(uuid);
drop table if exists public.invites cascade;

-- Phase 3: email-based pairing requests (requiring the client to know the
-- partner's exact account email) are themselves replaced by a shareable
-- invite LINK below — simpler for two people who'd rather just tap a link
-- than look up and type an email address. Same reasoning as the Phase 2
-- drop above: pre-launch, throwaway-account project, nothing worth
-- preserving (dropping the table also drops its policy).
drop function if exists public.send_pairing_request(uuid, text);
drop function if exists public.cancel_pairing_request(uuid);
drop function if exists public.decline_pairing_request(uuid);
drop function if exists public.accept_pairing_request(uuid);
drop table if exists public.pairing_requests cascade;

-- Phase 4: the short plain-text codes of Phase 3 (public.space_invites) are
-- replaced by invite links with secure, hashed, expiring, single-use tokens
-- (pairing_invites below; see supabase/migrations/20261015120000_secure_
-- pairing_invites.sql for the step-by-step upgrade of an existing project).
-- space_invites is not created on new projects any more; on projects that
-- already have it, it is left in place and its functions are retired at the
-- end of this file.
create table if not exists public.pairing_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create index if not exists pairing_invites_space_pending_idx on public.pairing_invites(space_id) where status = 'pending';

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
alter table public.pairing_invites enable row level security;

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

-- The creator can see their own invites (to restore "waiting for your
-- partner" after a reload). Nobody can read token hashes of invites they
-- didn't create, and there are no insert/update/delete policies: every
-- change goes through the functions below.
drop policy if exists "creator can read own pairing invites" on public.pairing_invites;
create policy "creator can read own pairing invites" on public.pairing_invites
  for select using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs — the only way clients create a space, create/revoke/redeem an
-- invite, or write data.
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

-- Hash used for storage and lookup. Raw tokens are never stored.
create or replace function public.pairing_invite_hash(raw_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(raw_token, ''), 'sha256'), 'hex');
$$;

-- Is the caller's ACTIVE membership in a space that someone else also
-- belongs to? (A space only the caller is in — e.g. they tapped "Invite your
-- partner" themselves before receiving their partner's link — doesn't count.)
create or replace function public.caller_is_partnered()
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.space_members me
    join public.space_members other on other.space_id = me.space_id and other.user_id <> me.user_id
    where me.user_id = auth.uid() and me.status = 'active'
  );
$$;

-- Create a new invite link for target_space. Any older pending invite for
-- the same space is cancelled first (its raw token can never be shown
-- again, so a new link replaces it rather than piling up live links).
create or replace function public.create_pairing_invite(target_space uuid, valid_hours integer default 48)
returns table(invite_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  raw text;
  ttl_hours integer := least(greatest(coalesce(valid_hours, 48), 1), 168);
  new_id uuid;
  new_expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not public.is_active_member(target_space) then
    raise exception 'You are not an active member of this Pairlum.';
  end if;
  if exists(select 1 from public.space_members where space_id = target_space and role = 'b') then
    raise exception 'This Pairlum already has two people in it.';
  end if;
  update public.pairing_invites set status = 'cancelled'
    where space_id = target_space and status = 'pending';
  raw := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  new_expiry := now() + make_interval(hours => ttl_hours);
  insert into public.pairing_invites(space_id, created_by, token_hash, expires_at)
    values (target_space, auth.uid(), public.pairing_invite_hash(raw), new_expiry)
    returning id into new_id;
  return query select new_id, raw, new_expiry;
end;
$$;

-- The creator cancels their own pending invite. The link stops working
-- immediately.
create or replace function public.cancel_pairing_invite(target_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update public.pairing_invites set status = 'cancelled'
    where id = target_invite and created_by = auth.uid() and status = 'pending';
  if not found then raise exception 'That invite is no longer active.'; end if;
end;
$$;

-- Read-only check for the person who opened a link, BEFORE they accept.
-- Returns a state the app turns into a plain message, and the inviter's
-- display name only when the invite is actually usable — never anything
-- from the shared space beyond that name.
--   valid | invalid | used | cancelled | expired | own | full | already_paired | signed_out
create or replace function public.preview_pairing_invite(raw_token text)
returns table(state text, inviter_name text, expires_at timestamptz)
language plpgsql security definer stable set search_path = public, extensions as $$
#variable_conflict use_column
declare
  inv public.pairing_invites;
begin
  if auth.uid() is null then
    return query select 'signed_out'::text, null::text, null::timestamptz; return;
  end if;
  select * into inv from public.pairing_invites where token_hash = public.pairing_invite_hash(raw_token);
  if inv.id is null then return query select 'invalid'::text, null::text, null::timestamptz; return; end if;
  if inv.status = 'accepted' then return query select 'used'::text, null::text, null::timestamptz; return; end if;
  if inv.status = 'cancelled' then return query select 'cancelled'::text, null::text, null::timestamptz; return; end if;
  if inv.expires_at <= now() then return query select 'expired'::text, null::text, null::timestamptz; return; end if;
  if inv.created_by = auth.uid() then return query select 'own'::text, null::text, null::timestamptz; return; end if;
  if exists(select 1 from public.space_members where space_id = inv.space_id and role = 'b') then
    return query select 'full'::text, null::text, null::timestamptz; return;
  end if;
  if public.caller_is_partnered() then
    return query select 'already_paired'::text, null::text, null::timestamptz; return;
  end if;
  return query
    select 'valid'::text, coalesce(s.data->'profiles'->'u_aarav'->>'name', 'Your partner'), inv.expires_at
    from public.spaces s where s.id = inv.space_id;
end;
$$;

-- The actual join. Only called after the person taps "Join our Pairlum".
-- Locks the invite row (and the space row) so two simultaneous accepts —
-- of the same link, or of anything racing to fill the second seat — run one
-- after the other; the second one sees the first one's result and stops.
create or replace function public.accept_pairing_invite(raw_token text)
returns public.spaces language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  inv public.pairing_invites;
  result public.spaces;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select * into inv from public.pairing_invites
    where token_hash = public.pairing_invite_hash(raw_token) for update;
  if inv.id is null then raise exception 'This invite link isn''t valid. Ask your partner to send it again.'; end if;
  if inv.status = 'accepted' then raise exception 'This invite has already been used.'; end if;
  if inv.status = 'cancelled' then raise exception 'This invite was cancelled. Ask your partner for a new link.'; end if;
  if inv.expires_at <= now() then raise exception 'This invite has expired. Ask your partner for a new link.'; end if;
  if inv.created_by = auth.uid() then raise exception 'This is your own invite — send it to your partner instead.'; end if;
  if public.caller_is_partnered() then
    raise exception 'You''re already connected in a Pairlum, so you can''t join another one.';
  end if;
  perform 1 from public.spaces where id = inv.space_id for update;
  if exists(select 1 from public.space_members where space_id = inv.space_id and role = 'b') then
    raise exception 'This Pairlum already has two people in it.';
  end if;
  -- If the caller had started a space of their own that nobody joined (both
  -- partners tapped "Invite"), step out of it: the row is kept, just no
  -- longer active, and its pending invites stop working.
  update public.pairing_invites set status = 'cancelled'
    where status = 'pending'
      and space_id in (select space_id from public.space_members where user_id = auth.uid() and status = 'active');
  update public.space_members set status = 'disconnected' where user_id = auth.uid() and status = 'active';
  insert into public.space_members(space_id, user_id, role) values (inv.space_id, auth.uid(), 'b');
  update public.pairing_invites set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = inv.id;
  select * into result from public.spaces where id = inv.space_id;
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

-- "Delete my account": ends every pairing the caller is part of (same rule as
-- disconnect_space — the space and the partner's content are kept), then
-- deletes the caller's login, which also removes their membership rows and
-- invites. The app removes the caller's own content first, while it still
-- has access. See supabase/migrations/20261016120000_delete_my_account.sql.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Please sign in first.'; end if;
  update public.space_members set status = 'disconnected'
    where space_id in (select space_id from public.space_members where user_id = me);
  begin
    update public.pairing_invites set accepted_by = null where accepted_by = me;
  exception when undefined_table then null; end;
  begin
    update public.space_invites set used_by = null where used_by = me;
  exception when undefined_table then null; end;
  begin
    update storage.objects set owner = null where owner = me;
  exception when undefined_table or undefined_column then null; end;
  delete from auth.users where id = me;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, update on public.spaces to authenticated;
grant select on public.space_members to authenticated;
grant select on public.pairing_invites to authenticated;
grant execute on function public.create_space(jsonb) to authenticated;
-- Supabase grants EXECUTE on new public functions to anon by default; the
-- invite functions are for signed-in users only.
revoke execute on function public.pairing_invite_hash(text) from public, anon, authenticated;
revoke execute on function public.caller_is_partnered() from public, anon;
revoke execute on function public.create_pairing_invite(uuid, integer) from public, anon;
revoke execute on function public.cancel_pairing_invite(uuid) from public, anon;
revoke execute on function public.preview_pairing_invite(text) from public, anon;
revoke execute on function public.accept_pairing_invite(text) from public, anon;
grant execute on function public.caller_is_partnered() to authenticated;
grant execute on function public.create_pairing_invite(uuid, integer) to authenticated;
grant execute on function public.cancel_pairing_invite(uuid) to authenticated;
grant execute on function public.preview_pairing_invite(text) to authenticated;
grant execute on function public.accept_pairing_invite(text) to authenticated;
grant execute on function public.write_space_data(uuid, jsonb, integer) to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.rejoin_space(uuid) to authenticated;
grant execute on function public.disconnect_space(uuid) to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Retire the Phase 3 code system on projects that still have it, without
-- deleting it: its functions can no longer be called and pending codes stop
-- working. No-ops on a new project.
do $$ begin revoke execute on function public.create_space_invite(uuid) from public, anon, authenticated;
exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.revoke_space_invite(text) from public, anon, authenticated;
exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.invite_preview(text) from public, anon, authenticated;
exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.redeem_space_invite(text) from public, anon, authenticated;
exception when undefined_function then null; end $$;
do $$ begin update public.space_invites set status = 'revoked' where status = 'pending';
exception when undefined_table then null; end $$;

-- ---------------------------------------------------------------------------
-- Realtime: let a client subscribe to changes on its own space row, and to
-- its own space_members rows (so the inviter's device learns the moment the
-- partner accepts the invite and joins, without polling). pairing_invites
-- doesn't need realtime — acceptance shows up as a space_members INSERT,
-- which is already covered here.
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.spaces;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.space_members;
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
