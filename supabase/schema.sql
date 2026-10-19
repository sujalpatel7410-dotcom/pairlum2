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
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.space_members
    where space_id = target_space and user_id = auth.uid()
  );
$$;

-- Member AND currently active (not left/disconnected) — used to gate writes
-- and invites, where "a member of this space" alone isn't enough: someone
-- who stepped away or disconnected can still read history, but not write.
create or replace function public.is_active_member(target_space uuid)
returns boolean language sql security definer stable set search_path = public as $$
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

-- No insert, update or delete policy: spaces are only ever created via
-- create_space() and changed via write_space_data() below (security
-- definer, with their own checks), so a client can never write the row
-- directly — not even a member who has left or disconnected.
drop policy if exists "members can update their space" on public.spaces;

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
-- EMPTY_SPACE constant) so a fresh couple never sees demo content. Any
-- "membership" in the seed is dropped: plans come from public.memberships.
create or replace function public.create_space(seed jsonb)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  new_space public.spaces;
begin
  if exists(select 1 from public.space_members where user_id = auth.uid() and status = 'active') then
    raise exception 'you already belong to a space';
  end if;
  insert into public.spaces(data) values (coalesce(seed, '{}'::jsonb) - 'membership') returning * into new_space;
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

-- ---------------------------------------------------------------------------
-- The guard: who may change what in the shared record. Both partners save
-- into one record; write_space_data checks every save against the stored
-- version and puts back any piece of the other person's that the save
-- changed (it does not refuse the save). The full rules are described in
-- supabase/migrations/20261019140000_guard.sql.
-- ---------------------------------------------------------------------------
-- Set a value at a path, creating a missing parent object; a NULL value
-- removes the path instead (jsonb_set would turn the whole document NULL).
create or replace function public.guard_set(doc jsonb, path text[], val jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  n int := array_length(path, 1);
begin
  if val is null then return doc #- path; end if;
  if n > 1 and jsonb_typeof(doc #> path[1:n-1]) is distinct from 'object' then
    doc := public.guard_set(doc, path[1:n-1], '{}'::jsonb);
  end if;
  return jsonb_set(doc, path, val, true);
end;
$$;

-- One list of items, matched by id. `akey` is the field naming the author
-- ("by", or "sharer" for the live log); `allowed` lists the fields the other
-- person may change ('*' = everything but the author); `partner_removes`
-- lets the other person remove items (chapters).
create or replace function public.guard_items(o_arr jsonb, n_arr jsonb, actor text, akey text,
  allowed text[], partner_removes boolean, now_ms numeric, out result jsonb, out problems text[])
language plpgsql immutable set search_path = public as $$
declare
  olds jsonb := '{}'::jsonb;
  seen jsonb := '{}'::jsonb;
  acc jsonb[] := '{}';
  e jsonb; o jsonb; keep jsonb; iid text; oa text; k text;
begin
  problems := '{}';
  if jsonb_typeof(n_arr) is distinct from 'array' then
    result := o_arr;   -- not a list at all: keep what was stored
    if n_arr is distinct from o_arr then problems := array['replaced a list with something else']; end if;
    return;
  end if;
  if jsonb_typeof(o_arr) = 'array' then
    select coalesce(jsonb_object_agg(x ->> 'id', x), '{}'::jsonb) into olds
      from jsonb_array_elements(o_arr) x
      where jsonb_typeof(x) = 'object' and (x ->> 'id') is not null;
  end if;
  for e in select value from jsonb_array_elements(n_arr) loop
    if jsonb_typeof(e) <> 'object' or (e ->> 'id') is null then
      acc := acc || e;
      continue;
    end if;
    iid := e ->> 'id';
    if seen ? iid then
      problems := problems || ('duplicate ' || iid);
      continue;
    end if;
    seen := seen || jsonb_build_object(iid, true);
    o := olds -> iid;
    if o is null then
      -- New: it can't be added in the other person's name.
      if (e ->> akey) is not null and (e ->> akey) <> actor then
        problems := problems || ('added in the other person''s name: ' || iid);
        continue;
      end if;
      acc := acc || e;
      continue;
    end if;
    oa := o ->> akey;
    if oa is not null and oa <> actor then
      -- The other person's item: only the allowed fields may change.
      if allowed = array['*'] then
        keep := (e - akey) || jsonb_build_object(akey, o -> akey);
      else
        keep := o;
        foreach k in array allowed loop
          if e ? k then keep := keep || jsonb_build_object(k, e -> k); else keep := keep - k; end if;
        end loop;
      end if;
      if keep is distinct from e then problems := problems || ('changed the other person''s ' || iid); end if;
      acc := acc || keep;
    elsif (e ->> akey) is distinct from oa then
      -- Mine (or nobody's): anything may change except who added it.
      keep := e - akey;
      if o ? akey then keep := keep || jsonb_build_object(akey, o -> akey); end if;
      problems := problems || ('changed who added ' || iid);
      acc := acc || keep;
    else
      acc := acc || e;
    end if;
  end loop;
  -- Removed items: fine if mine, nobody's, removable by either of us, or in
  -- Recently Deleted for more than 30 days. Otherwise put back.
  for iid, o in select key, value from jsonb_each(olds) loop
    continue when seen ? iid;
    oa := o ->> akey;
    continue when oa is null or oa = actor or partner_removes
      or (jsonb_typeof(o -> 'deletedAt') = 'number' and now_ms - (o ->> 'deletedAt')::numeric > 2592000000);
    problems := problems || ('removed the other person''s ' || iid);
    acc := acc || o;
  end loop;
  result := to_jsonb(acc);
end;
$$;

-- A per-person map. depth 1: map.<person> (e.g. profiles). depth 2:
-- map.<key>.<person> (e.g. feel.<day>, hearts.<moment>); other keys inside a
-- depth-2 bucket (like dq.<day>._q, the day's question) stay shared.
create or replace function public.guard_person_map(o jsonb, n jsonb, actor text, partner text, depth int,
  out result jsonb, out problems text[])
language plpgsql immutable set search_path = public as $$
declare
  om jsonb := case when jsonb_typeof(o) = 'object' then o else '{}'::jsonb end;
  nm jsonb;
  k text; ob jsonb; nb jsonb; ov jsonb; nv jsonb; base jsonb;
begin
  problems := '{}';
  if jsonb_typeof(n) = 'object' then nm := n;
  elsif n is null and o is null then result := n; return;
  else nm := '{}'::jsonb;
  end if;
  if depth = 1 then
    if (nm -> partner) is distinct from (om -> partner) then
      nm := case when om ? partner then nm || jsonb_build_object(partner, om -> partner) else nm - partner end;
      problems := problems || 'changed the other person''s entry'::text;
    end if;
  else
    for k in select jsonb_object_keys(om) union select jsonb_object_keys(nm) loop
      ob := om -> k; nb := nm -> k;
      ov := case when jsonb_typeof(ob) = 'object' then ob -> partner end;
      nv := case when jsonb_typeof(nb) = 'object' then nb -> partner end;
      continue when ov is not distinct from nv;
      base := case when jsonb_typeof(nb) = 'object' then nb
                   when jsonb_typeof(ob) = 'object' then ob - actor
                   else '{}'::jsonb end;
      base := case when ov is not null then base || jsonb_build_object(partner, ov) else base - partner end;
      nm := jsonb_set(nm, array[k], base, true);
      problems := problems || ('changed the other person''s entry in ' || k);
    end loop;
  end if;
  result := nm;
end;
$$;

-- Write-ups (understood.<recording id>) for the other person's recordings
-- (their moments, the voice attached to them, their replies) stay theirs.
create or replace function public.guard_understood(o_und jsonb, n_und jsonb, data jsonb, partner text,
  out result jsonb, out problems text[])
language plpgsql immutable set search_path = public as $$
declare
  rid text;
  om jsonb := case when jsonb_typeof(o_und) = 'object' then o_und else '{}'::jsonb end;
  nm jsonb := case when jsonb_typeof(n_und) = 'object' then n_und else '{}'::jsonb end;
  moments jsonb := case when jsonb_typeof(data -> 'moments') = 'array' then data -> 'moments' else '[]'::jsonb end;
  replies jsonb := case when jsonb_typeof(data -> 'replies') = 'array' then data -> 'replies' else '[]'::jsonb end;
begin
  problems := '{}';
  for rid in
    select distinct r from (
      select x ->> 'id' as r from jsonb_array_elements(moments) x where x ->> 'by' = partner
      union all
      select x -> 'voice' ->> 'id' from jsonb_array_elements(moments) x where x ->> 'by' = partner
      union all
      select x ->> 'id' from jsonb_array_elements(replies) x where x ->> 'by' = partner
    ) s where r is not null
  loop
    continue when (nm -> rid) is not distinct from (om -> rid);
    nm := case when om ? rid then nm || jsonb_build_object(rid, om -> rid) else nm - rid end;
    problems := problems || ('changed the other person''s write-up ' || rid);
  end loop;
  result := case when n_und is null and nm = '{}'::jsonb then n_und else nm end;
end;
$$;

-- The whole check. o = stored record, n = what the app sent.
create or replace function public.guard_space_data(o jsonb, n jsonb, actor text, partner text, solo boolean, now_ms numeric,
  out result jsonb, out problems text[])
language plpgsql immutable set search_path = public as $$
declare
  spec record; g record; ov jsonb; nv jsonb; oc jsonb; nc jsonb; c jsonb; oldc jsonb;
  colls jsonb[];
begin
  problems := '{}';
  result := n;
  if solo then return; end if;

  for spec in select * from (values
      (array['moments'], 'by', '{}'::text[], false),
      (array['notes'], 'by', '{}'::text[], false),
      (array['letters'], 'by', '{}'::text[], false),
      (array['memories'], 'by', '{}'::text[], false),
      (array['plans'], 'by', '{}'::text[], false),
      (array['replies'], 'by', '{}'::text[], false),
      (array['dates'], 'by', '{}'::text[], false),
      (array['someday'], 'by', array['done'], false),
      (array['requests'], 'by', array['reply', 'replyAt'], false),
      (array['liveLog'], 'sharer', '{}'::text[], false),
      (array['chapters'], 'by', array['*'], true),
      (array['dna', 'rituals'], 'by', array['count', 'last'], false),
      (array['dna', 'collections'], 'by', array['items'], false)
    ) as t(path, akey, allowed, removable)
  loop
    ov := o #> spec.path; nv := result #> spec.path;
    continue when ov is not distinct from nv;
    select * into g from public.guard_items(ov, nv, actor, spec.akey, spec.allowed, spec.removable, now_ms);
    if g.result is distinct from nv then result := public.guard_set(result, spec.path, g.result); end if;
    problems := problems || g.problems;
  end loop;

  -- Entries inside each collection follow the item rules too.
  oc := o #> '{dna,collections}'; nc := result #> '{dna,collections}';
  if jsonb_typeof(oc) = 'array' and jsonb_typeof(nc) = 'array' and oc is distinct from nc then
    colls := '{}';
    for c in select value from jsonb_array_elements(nc) loop
      oldc := (select x from jsonb_array_elements(oc) x where x ->> 'id' = c ->> 'id' limit 1);
      if oldc is not null and jsonb_typeof(c) = 'object' and (oldc -> 'items') is distinct from (c -> 'items') then
        select * into g from public.guard_items(oldc -> 'items', c -> 'items', actor, 'by', '{}'::text[], false, now_ms);
        if g.result is distinct from (c -> 'items') then c := public.guard_set(c, '{items}', g.result); end if;
        problems := problems || g.problems;
      end if;
      colls := colls || c;
    end loop;
    if to_jsonb(colls) is distinct from nc then result := public.guard_set(result, '{dna,collections}', to_jsonb(colls)); end if;
  end if;

  for spec in select * from (values
      (array['profiles'], 1), (array['prefs'], 1), (array['sleep'], 1), (array['facts'], 1),
      (array['comfort'], 1), (array['ambient'], 1), (array['profileAt'], 1), (array['dna', 'people'], 1),
      (array['feel'], 2), (array['dq'], 2), (array['hearts'], 2), (array['reacts'], 2),
      (array['days'], 2), (array['quiz', 'answers'], 2), (array['favs'], 2), (array['hidden'], 2)
    ) as t(path, depth)
  loop
    ov := o #> spec.path; nv := result #> spec.path;
    continue when ov is not distinct from nv;
    select * into g from public.guard_person_map(ov, nv, actor, partner, spec.depth);
    if g.result is distinct from nv then result := public.guard_set(result, spec.path, g.result); end if;
    problems := problems || g.problems;
  end loop;

  ov := o -> 'understood'; nv := result -> 'understood';
  if ov is distinct from nv then
    select * into g from public.guard_understood(ov, nv, result, partner);
    if g.result is distinct from nv then result := public.guard_set(result, '{understood}', g.result); end if;
    problems := problems || g.problems;
  end if;
end;
$$;

-- The guard functions are internal: only write_space_data (which runs with
-- elevated rights) calls them.
revoke execute on function public.guard_set(jsonb, text[], jsonb) from public, anon, authenticated;
revoke execute on function public.guard_items(jsonb, jsonb, text, text, text[], boolean, numeric) from public, anon, authenticated;
revoke execute on function public.guard_person_map(jsonb, jsonb, text, text, int) from public, anon, authenticated;
revoke execute on function public.guard_understood(jsonb, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.guard_space_data(jsonb, jsonb, text, text, boolean, numeric) from public, anon, authenticated;

-- Optimistic-concurrency write, now with the guard: succeeds only if `rev`
-- still matches what the caller last read (returns NULL on a conflict, not an
-- error); keeps the stored "membership"; applies the rules above.
create or replace function public.write_space_data(target_space uuid, new_data jsonb, expected_rev integer)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  m public.space_members;
  old jsonb;
  g record;
  result public.spaces;
begin
  select * into m from public.space_members
    where space_id = target_space and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not an active member of this space — rejoin before making changes';
  end if;
  if jsonb_typeof(new_data) is distinct from 'object' then
    raise exception 'That save looks damaged, so it wasn''t stored. Reload Pairlum and try again.';
  end if;
  select data into old from public.spaces where id = target_space and rev = expected_rev for update;
  if not found then return null; end if;
  new_data := (new_data - 'membership')
              || case when old ? 'membership' then jsonb_build_object('membership', old -> 'membership') else '{}'::jsonb end;
  select * into g from public.guard_space_data(
    old, new_data,
    case m.role when 'b' then 'u_mira' else 'u_aarav' end,
    case m.role when 'b' then 'u_aarav' else 'u_mira' end,
    not exists (select 1 from public.space_members where space_id = target_space and role = 'b'),
    (extract(epoch from now()) * 1000)::numeric);
  if cardinality(g.problems) > 0 then
    raise warning 'pairlum guard %: %', target_space, g.problems;
  end if;
  update public.spaces set data = g.result, rev = rev + 1, updated_at = now()
    where id = target_space
    returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membership: one row per space with a paid plan. The app can read it; only
-- the service role (the future payment webhook) or the SQL editor can write
-- it. No auto-renewal: a plan has a fixed end and simply ends.
-- See supabase/migrations/20261019130000_memberships.sql (and how to give a
-- test space a plan by hand).
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  plan text not null check (plan in ('digital', 'book')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual', 'payment', 'gift')),
  updated_at timestamptz not null default now(),
  check (ends_at > started_at)
);
alter table public.memberships enable row level security;
drop policy if exists "members can read their membership" on public.memberships;
create policy "members can read their membership" on public.memberships
  for select using (public.is_space_member(space_id));

-- The plan, with Book eligibility decided here on the server: one full year
-- on the Book plan. No row = the free First Chapter (or not a member).
create or replace function public.my_membership(target_space uuid)
returns table(plan text, started_at timestamptz, ends_at timestamptz, active boolean,
              book_eligible_at timestamptz, book_eligible boolean)
language sql security definer stable set search_path = public as $$
  select m.plan, m.started_at, m.ends_at,
         now() < m.ends_at,
         case when m.plan = 'book' then m.started_at + interval '1 year' end,
         m.plan = 'book' and now() >= m.started_at + interval '1 year'
  from public.memberships m
  where m.space_id = target_space and public.is_space_member(target_space);
$$;

-- Step away without ending the connection: pauses writes for the CALLER only
-- (write_space_data requires is_active_member) until the same account calls
-- rejoin_space. The other partner's row, and their ability to write, is
-- completely unaffected — matches the app's own "Leave" copy ("[partner]
-- keeps this space exactly as it is — nothing changes on their side").
create or replace function public.leave_space(target_space uuid)
returns void language plpgsql security definer set search_path = public as $$
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
returns void language plpgsql security definer set search_path = public as $$
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
returns void language plpgsql security definer set search_path = public as $$
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
grant select on public.spaces to authenticated;
-- Supabase grants new tables to anon/authenticated by default; writes go
-- only through the functions above, so take the table-level write grants away.
revoke insert, update, delete, truncate on public.spaces, public.space_members, public.pairing_invites from anon, authenticated;
grant select on public.space_members to authenticated;
grant select on public.pairing_invites to authenticated;
grant execute on function public.create_space(jsonb) to authenticated;
revoke insert, update, delete, truncate on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;
revoke execute on function public.my_membership(uuid) from public, anon;
grant execute on function public.my_membership(uuid) to authenticated;
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
do $$ begin
  alter publication supabase_realtime add table public.memberships;
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

-- Anyone in the space can view (history stays readable after stepping away
-- or disconnecting); only active members can add files; only a file's own
-- uploader can replace it, or delete it (deleting stays possible after
-- stepping away, e.g. while deleting your account).
drop policy if exists "space members can read their media" on storage.objects;
create policy "space members can read their media" on storage.objects
  for select using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid));

drop policy if exists "space members can upload their media" on storage.objects;
create policy "space members can upload their media" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_active_member((storage.foldername(name))[1]::uuid));

drop policy if exists "space members can overwrite their media" on storage.objects;
create policy "space members can overwrite their media" on storage.objects
  for update
  using (bucket_id = 'media' and public.is_active_member((storage.foldername(name))[1]::uuid)
         and (owner_id = auth.uid()::text or owner = auth.uid()))
  with check (bucket_id = 'media' and public.is_active_member((storage.foldername(name))[1]::uuid)
         and (owner_id = auth.uid()::text or owner = auth.uid()));

drop policy if exists "space members can delete their media" on storage.objects;
create policy "space members can delete their media" on storage.objects
  for delete using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid)
         and (owner_id = auth.uid()::text or owner = auth.uid()));

-- ---------------------------------------------------------------------------
-- The live "signal" channel (topic "space-<space id>": "I Need You" live
-- listening, hold-the-heart) is a private Realtime channel: members who are
-- active or have stepped away can receive, only active members can send.
-- ---------------------------------------------------------------------------
do $$ begin
  execute 'drop policy if exists "space members can receive live signals" on realtime.messages';
  execute $p$
    create policy "space members can receive live signals" on realtime.messages
      for select to authenticated
      using (exists (
        select 1 from public.space_members m
        where m.user_id = auth.uid() and m.status in ('active', 'left')
          and realtime.topic() = 'space-' || m.space_id::text))
  $p$;
  execute 'drop policy if exists "active space members can send live signals" on realtime.messages';
  execute $p$
    create policy "active space members can send live signals" on realtime.messages
      for insert to authenticated
      with check (exists (
        select 1 from public.space_members m
        where m.user_id = auth.uid() and m.status = 'active'
          and realtime.topic() = 'space-' || m.space_id::text))
  $p$;
exception when undefined_table or invalid_schema_name or undefined_function then
  raise notice 'Realtime Authorization (realtime.messages) is not available on this project; live-signal channel left as it was.';
end $$;
