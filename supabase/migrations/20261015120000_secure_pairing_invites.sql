-- ============================================================================
-- Migration: secure pairing invites
--
-- Replaces the 8-character invite codes (public.space_invites, generated with
-- random() and stored in plain text, never expiring) with invite LINKS whose
-- tokens are:
--   * generated with a cryptographically secure source (pgcrypto
--     gen_random_bytes, 192 bits),
--   * stored only as a SHA-256 hash — the raw token is returned exactly once,
--     to the person who created it,
--   * time-limited (48 hours by default, 1–168 hours allowed),
--   * single-use, and redeemed under a row lock so two simultaneous accepts
--     of the same link can't both succeed.
--
-- Additive and non-destructive: nothing is dropped. Existing spaces, members
-- and data are untouched. The old invite-code functions stay in the database
-- but can no longer be called by the app, and any still-pending old codes are
-- marked 'revoked' so they stop working.
--
-- Apply (existing project): Supabase Dashboard → SQL Editor → New query →
-- paste this whole file → Run. Safe to run more than once.
-- New projects: supabase/schema.sql already contains everything here.
-- ============================================================================

create extension if not exists pgcrypto;

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

alter table public.pairing_invites enable row level security;
-- The creator can see their own invites (to restore "waiting for your
-- partner" after a reload). Nobody can read token hashes of invites they
-- didn't create, and there are no insert/update/delete policies: every
-- change goes through the functions below.
drop policy if exists "creator can read own pairing invites" on public.pairing_invites;
create policy "creator can read own pairing invites" on public.pairing_invites
  for select using (created_by = auth.uid());

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

-- Supabase grants EXECUTE on new public functions to anon by default; these
-- are for signed-in users only.
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
grant select on public.pairing_invites to authenticated;

-- Retire the old 8-character code system without deleting it.
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
