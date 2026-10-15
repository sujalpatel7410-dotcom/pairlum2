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

-- One row per invite link/code. Short-lived and single-use: `redeem_space_
-- invite` below marks it 'used' the moment someone joins through it, and a
-- space only ever needs one live code at a time (create_space_invite reuses
-- an existing pending one instead of minting duplicates).
create table if not exists public.space_invites (
  code text primary key,
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','used','revoked')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id)
);

create index if not exists space_invites_space_id_idx on public.space_invites(space_id) where status = 'pending';

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
alter table public.space_invites enable row level security;

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

drop policy if exists "creator can read their own invites" on public.space_invites;
create policy "creator can read their own invites" on public.space_invites
  for select using (created_by = auth.uid());
-- No insert/update/delete policy, and no select for anyone but the creator
-- (a redeemer never needs to read the row directly — redeem_space_invite
-- below looks it up as security definer and returns the space, not the
-- invite): every write goes through the RPCs below, so a client can never
-- forge, revoke someone else's, or peek at a code they weren't given.

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

-- Create (or re-fetch) a shareable invite for target_space. Requires the
-- caller to already be an active member (the client always calls
-- create_space first if it doesn't have one yet — see pairlum-sync.js's
-- ensureSpace) and for that space to still have room for a 'b' member.
-- Reuses an existing pending code instead of minting a new one each time
-- the pairing screen is opened, so an already-shared link doesn't go stale
-- the moment a second one is generated.
create or replace function public.create_space_invite(target_space uuid)
returns public.space_invites language plpgsql security definer as $$
declare
  existing public.space_invites;
  new_invite public.space_invites;
  new_code text;
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I — matches app.js's genInviteCode()
  i int;
begin
  if not public.is_active_member(target_space) then
    raise exception 'not an active member of this space';
  end if;
  if exists(select 1 from public.space_members where space_id = target_space and role = 'b') then
    raise exception 'this space already has two members';
  end if;
  select * into existing from public.space_invites
    where space_id = target_space and status = 'pending'
    order by created_at desc limit 1;
  if existing.code is not null then
    return existing;
  end if;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists(select 1 from public.space_invites where code = new_code);
  end loop;
  insert into public.space_invites(code, space_id, created_by) values (new_code, target_space, auth.uid())
    returning * into new_invite;
  return new_invite;
end;
$$;

-- Creator cancels their own still-pending invite (the "Revoke" button) — the
-- link stops working immediately even if someone still has it open.
create or replace function public.revoke_space_invite(invite_code text)
returns void language plpgsql security definer as $$
begin
  update public.space_invites set status = 'revoked'
    where code = upper(trim(invite_code)) and created_by = auth.uid() and status = 'pending';
  if not found then
    raise exception 'that invite is no longer available';
  end if;
end;
$$;

-- Lets whoever holds a pending code see who it's from before they commit to
-- joining — the "Join this Pairlum?" confirmation screen, shown BEFORE
-- redeem_space_invite ever runs. Security definer: the code itself is the
-- credential here, same as everywhere else a link/code gates access, so no
-- separate read policy on space_invites is needed for this.
create or replace function public.invite_preview(invite_code text)
returns table(inviter_name text) language plpgsql security definer as $$
declare
  inv public.space_invites;
begin
  select * into inv from public.space_invites where code = upper(trim(invite_code)) and status = 'pending';
  if inv is null then
    raise exception 'That invite link has expired or already been used.';
  end if;
  return query
    select coalesce(s.data->'profiles'->'u_aarav'->>'name', 'Your partner') from public.spaces s where s.id = inv.space_id;
end;
$$;

-- The actual join step: only ever called after the person has explicitly
-- confirmed "Join this Pairlum?" in the UI (opening the link alone shows
-- that confirmation, it does not redeem anything by itself). Joins the
-- inviter's space as role 'b' and marks the code used so it can't be reused.
create or replace function public.redeem_space_invite(invite_code text)
returns public.spaces language plpgsql security definer as $$
declare
  inv public.space_invites;
  result public.spaces;
begin
  select * into inv from public.space_invites where code = upper(trim(invite_code)) and status = 'pending';
  if inv is null then
    raise exception 'That invite link has expired or already been used.';
  end if;
  if inv.created_by = auth.uid() then
    raise exception 'you can''t use your own invite link';
  end if;
  if exists(select 1 from public.space_members where user_id = auth.uid() and status = 'active') then
    raise exception 'you already belong to a space';
  end if;
  if exists(select 1 from public.space_members where space_id = inv.space_id and role = 'b') then
    raise exception 'this space already has two members';
  end if;
  insert into public.space_members(space_id, user_id, role) values (inv.space_id, auth.uid(), 'b');
  update public.space_invites set status = 'used', used_at = now(), used_by = auth.uid() where code = inv.code;
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

grant usage on schema public to anon, authenticated;
grant select, update on public.spaces to authenticated;
grant select on public.space_members to authenticated;
grant select on public.space_invites to authenticated;
grant execute on function public.create_space(jsonb) to authenticated;
grant execute on function public.create_space_invite(uuid) to authenticated;
grant execute on function public.revoke_space_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.redeem_space_invite(text) to authenticated;
grant execute on function public.write_space_data(uuid, jsonb, integer) to authenticated;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.rejoin_space(uuid) to authenticated;
grant execute on function public.disconnect_space(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: let a client subscribe to changes on its own space row, and to
-- its own space_members rows (so the inviter's device learns the moment the
-- partner redeems the invite and joins, without polling). space_invites
-- doesn't need realtime — redemption shows up as a space_members INSERT,
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
