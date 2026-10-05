-- ============================================================================
-- PAIRLUM 2 — Supabase schema + RLS
-- ============================================================================
-- Run this once in Supabase SQL Editor (Project → SQL Editor → New query)
-- on a fresh project. Safe to re-run: everything is CREATE ... IF NOT EXISTS
-- or CREATE OR REPLACE.
--
-- Model: a "space" is a private couple space with exactly two members
-- (space_members). Every content table (moments, signals, need_requests,
-- letters, plans, rituals) is scoped to a space_id and readable/writable
-- only by that space's two members. Authorship rules from
-- docs/master-instructions.md are enforced by trigger (§19/§20): a memory's
-- author can edit/delete it; the partner may only toggle favorite/hidden/
-- chapter on it, never rewrite its content.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (one row per auth.users row — name, avatar, personal prefs)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  mood text not null default 'warm' check (mood in ('warm','calm','deep','blush','midnight')),
  sound boolean not null default true,
  haptics boolean not null default true,
  motion boolean not null default true,
  quiet_hours_on boolean not null default false,      -- couple-friendly on/off for the Settings toggle
  quiet_start time,              -- start of this person's quiet hours (local time)
  quiet_end time,                -- end of this person's quiet hours (local time)
  timezone text,                 -- IANA tz, e.g. 'Asia/Kolkata' — set client-side from Intl.DateTimeFormat
  deliver_for_morning boolean not null default false, -- hold non-urgent signals until this person's morning instead of during their quiet hours
  first_chapter_done boolean not null default false,  -- THIS PERSON's own First Chapter — one row per person, not per space:
  first_chapter_at timestamptz,                        -- each partner completes their own onboarding walkthrough independently
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: read own" on profiles for select
  using (id = auth.uid());
create policy "profiles: read partner's" on profiles for select
  using (exists (
    select 1 from space_members sm1
    join space_members sm2 on sm2.space_id = sm1.space_id
    where sm1.user_id = auth.uid() and sm2.user_id = profiles.id
  ));
create policy "profiles: update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: insert own" on profiles for insert
  with check (id = auth.uid());

-- Auto-create a profile row the moment someone signs up.
create or replace function pl2_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists pl2_on_auth_user_created on auth.users;
create trigger pl2_on_auth_user_created
  after insert on auth.users
  for each row execute function pl2_handle_new_user();

-- ---------------------------------------------------------------------------
-- spaces — the couple space itself
-- ---------------------------------------------------------------------------
create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  invite_code text unique,
  invite_expires_at timestamptz default (now() + interval '7 days'),
  -- "First Chapter" is each PERSON's own onboarding walkthrough (profiles.first_chapter_done),
  -- not a shared space flag — a space has no first-chapter state of its own.
  since date,                    -- relationship start (real relationship history, not a device guess)
  ldr boolean not null default false,
  city_a text,
  city_b text,
  ldr_label text,
  reunion_date date,
  created_at timestamptz not null default now()
);

alter table spaces enable row level security;

create or replace function pl2_is_space_member(p_space_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from space_members where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create policy "spaces: members can read" on spaces for select
  using (pl2_is_space_member(id));
create policy "spaces: members can update" on spaces for update
  using (pl2_is_space_member(id)) with check (pl2_is_space_member(id));
-- No direct insert policy: spaces are created only via pl2_create_space() below,
-- which runs as SECURITY DEFINER so the creator can be added as a member in
-- the same transaction (a bare INSERT here would hit a chicken-and-egg RLS
-- problem — pl2_is_space_member() can't be true before space_members exists).

-- ---------------------------------------------------------------------------
-- space_members — exactly two people per space
-- ---------------------------------------------------------------------------
create table if not exists space_members (
  space_id uuid not null references spaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id),
  primary key (space_id, user_id)
);

alter table space_members enable row level security;

create policy "space_members: members can read their space's roster" on space_members for select
  using (pl2_is_space_member(space_id));
-- No direct insert/delete policy: membership changes only through
-- pl2_create_space() / pl2_accept_invite() / leave_space() below.

create or replace function pl2_enforce_two_members()
returns trigger language plpgsql as $$
begin
  if (select count(*) from space_members where space_id = new.space_id) >= 2 then
    raise exception 'space_full' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists pl2_trg_two_members on space_members;
create trigger pl2_trg_two_members
  before insert on space_members
  for each row execute function pl2_enforce_two_members();

-- ---------------------------------------------------------------------------
-- RPCs: pl2_create_space / pl2_lookup_invite / pl2_accept_invite / leave_space
-- These mirror PL.space.create / PL.invites.lookup / PL.invites.accept in
-- pairlum-core.js, so the frontend adapter is a thin call-through.
-- ---------------------------------------------------------------------------
create or replace function pl2_gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- matches PL.invites.newCode() — no ambiguous chars
  code text;
begin
  code := 'PAIR-';
  for i in 1..6 loop
    code := code || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1);
  end loop;
  return code;
end $$;

create or replace function pl2_create_space(
  p_since date default null, p_ldr boolean default false,
  p_city_a text default null, p_city_b text default null
) returns spaces
language plpgsql security definer set search_path = public as $$
declare
  s spaces;
  existing_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select space_id into existing_id from space_members where user_id = auth.uid() limit 1;
  if existing_id is not null then
    select * into s from spaces where id = existing_id;
    return s;
  end if;
  insert into spaces (created_by, invite_code, since, ldr, city_a, city_b)
  values (auth.uid(), pl2_gen_invite_code(), p_since, p_ldr, p_city_a, p_city_b)
  returning * into s;
  insert into space_members (space_id, user_id) values (s.id, auth.uid());
  return s;
end $$;

create or replace function pl2_lookup_invite(p_code text)
returns table(status text, inviter_name text, space_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  s spaces;
  member_count int;
  inviter profiles;
begin
  select * into s from spaces where invite_code = upper(trim(p_code));
  if s.id is null then return query select 'invalid', null::text, null::uuid; return; end if;
  if s.invite_expires_at is not null and s.invite_expires_at < now() then
    return query select 'expired', null::text, s.id; return;
  end if;
  select count(*) into member_count from space_members where space_id = s.id;
  if member_count >= 2 then
    if exists (select 1 from space_members where space_id = s.id and user_id = auth.uid()) then
      return query select 'already_connected', null::text, s.id; return;
    end if;
    return query select 'space_full', null::text, s.id; return;
  end if;
  if s.created_by = auth.uid() then return query select 'own', null::text, s.id; return; end if;
  select * into inviter from profiles where id = s.created_by;
  return query select 'valid', inviter.name, s.id;
end $$;

create or replace function pl2_accept_invite(p_code text)
returns table(status text, inviter_name text, space_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  s spaces;
  member_count int;
  inviter profiles;
  already_in_other boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into s from spaces where invite_code = upper(trim(p_code)) for update;
  if s.id is null then return query select 'invalid', null::text, null::uuid; return; end if;
  if s.invite_expires_at is not null and s.invite_expires_at < now() then
    return query select 'expired', null::text, s.id; return;
  end if;
  if exists (select 1 from space_members where space_id = s.id and user_id = auth.uid()) then
    select * into inviter from profiles where id = s.created_by;
    return query select 'already_connected', inviter.name, s.id; return;
  end if;
  if s.created_by = auth.uid() then return query select 'own', null::text, s.id; return; end if;
  select exists(select 1 from space_members where user_id = auth.uid()) into already_in_other;
  if already_in_other then return query select 'error', null::text, null::uuid; return; end if;
  select count(*) into member_count from space_members where space_id = s.id;
  if member_count >= 2 then return query select 'space_full', null::text, s.id; return; end if;
  insert into space_members (space_id, user_id) values (s.id, auth.uid());
  select * into inviter from profiles where id = s.created_by;
  return query select 'connected', inviter.name, s.id;
end $$;

-- Grant execute to the authenticated + anon roles Supabase uses (RLS/SECURITY
-- DEFINER inside each function still governs what actually happens).
grant execute on function pl2_create_space(date,boolean,text,text) to authenticated;
grant execute on function pl2_lookup_invite(text) to authenticated, anon;
grant execute on function pl2_accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- moments — the single content primitive (§5 of master-instructions.md)
-- ---------------------------------------------------------------------------
create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  type text not null check (type in ('text','photo','voice','video')),
  text text not null default '',
  photo_path text,                 -- Storage object path, bucket 'moment-photos'
  date timestamptz not null default now(),
  mood text not null default '',
  chapter text,
  fav boolean not null default false,
  hidden boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,          -- soft delete: 30-day "Recently deleted" restore window
  created_at timestamptz not null default now()
);

create index if not exists moments_space_idx on moments (space_id, date desc);
alter table moments enable row level security;

create policy "moments: members can read" on moments for select
  using (pl2_is_space_member(space_id));
create policy "moments: members can insert their own" on moments for insert
  with check (pl2_is_space_member(space_id) and by = auth.uid());
create policy "moments: members can update" on moments for update
  using (pl2_is_space_member(space_id)) with check (pl2_is_space_member(space_id));
create policy "moments: author can delete" on moments for delete
  using (by = auth.uid());

-- §20: a partner may toggle fav / hidden / chapter on someone else's moment,
-- but never rewrite its content. §19: the author may change anything.
create or replace function pl2_enforce_moment_update_authorship()
returns trigger language plpgsql as $$
begin
  if new.space_id is distinct from old.space_id then raise exception 'cannot move content between spaces'; end if;
  if new.by <> old.by then raise exception 'cannot reassign moment authorship'; end if;
  if old.by <> auth.uid() then
    if new.text is distinct from old.text or new.type is distinct from old.type
       or new.photo_path is distinct from old.photo_path or new.date is distinct from old.date
       or new.mood is distinct from old.mood or new.deleted_at is distinct from old.deleted_at then
      raise exception 'only the author can edit this memory' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pl2_trg_moment_update_authorship on moments;
create trigger pl2_trg_moment_update_authorship
  before update on moments
  for each row execute function pl2_enforce_moment_update_authorship();

-- ---------------------------------------------------------------------------
-- signals — Thinking of You (Glow/Pull/Hold/Spark/Closer): wordless, no reply
-- ---------------------------------------------------------------------------
create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  kind text not null check (kind in ('glow','pull','hold','spark','closer')),
  created_at timestamptz not null default now()
);
create index if not exists signals_space_idx on signals (space_id, created_at desc);
alter table signals enable row level security;
create policy "signals: members can read" on signals for select using (pl2_is_space_member(space_id));
create policy "signals: members can send" on signals for insert
  with check (pl2_is_space_member(space_id) and by = auth.uid());

-- ---------------------------------------------------------------------------
-- need_requests — I Need You: "what would help right now", answered by a
-- real partner (never AI-generated — §8 of master-instructions.md)
-- ---------------------------------------------------------------------------
create table if not exists need_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  category text not null,
  note text,
  no_reply_needed boolean not null default false,
  response_text text,
  response_kind text check (response_kind in ('text','voice','video')),
  responded_by uuid references profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists need_space_idx on need_requests (space_id, created_at desc);
alter table need_requests enable row level security;
create policy "need: members can read" on need_requests for select using (pl2_is_space_member(space_id));
create policy "need: members can send" on need_requests for insert
  with check (pl2_is_space_member(space_id) and by = auth.uid());
create policy "need: partner can respond, author can edit" on need_requests for update
  using (pl2_is_space_member(space_id)) with check (pl2_is_space_member(space_id));

-- Only the partner (not the author) may fill in a response; only the author
-- may change their own request content.
create or replace function pl2_enforce_need_update()
returns trigger language plpgsql as $$
begin
  if new.by is distinct from old.by or new.space_id is distinct from old.space_id then raise exception 'cannot reassign request'; end if;
  if old.by = auth.uid() then
    if new.response_text is distinct from old.response_text
       or new.responded_at is distinct from old.responded_at then
      raise exception 'only your partner can respond to this' using errcode = 'P0001';
    end if;
  else
    if new.category is distinct from old.category or new.note is distinct from old.note then
      raise exception 'only the author can edit this request' using errcode = 'P0001';
    end if;
    new.responded_by := auth.uid();
    if new.response_text is not null and old.response_text is null then new.responded_at := now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists pl2_trg_need_update on need_requests;
create trigger pl2_trg_need_update
  before update on need_requests
  for each row execute function pl2_enforce_need_update();

-- ---------------------------------------------------------------------------
-- letters — sealed letters / capsules
-- ---------------------------------------------------------------------------
create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  sealed_until date,
  opened boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
alter table letters enable row level security;
create policy "letters: members can read" on letters for select using (pl2_is_space_member(space_id));
create policy "letters: members can write their own" on letters for insert
  with check (pl2_is_space_member(space_id) and by = auth.uid());
create policy "letters: members can mark opened" on letters for update
  using (pl2_is_space_member(space_id)) with check (pl2_is_space_member(space_id));
create policy "letters: author can delete" on letters for delete using (by = auth.uid());

-- ---------------------------------------------------------------------------
-- plans & rituals — Together tab
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  cat text not null default 'Dates',
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table plans enable row level security;
create policy "plans: members can read" on plans for select using (pl2_is_space_member(space_id));
create policy "plans: members can write" on plans for insert with check (pl2_is_space_member(space_id));
create policy "plans: members can update" on plans for update
  using (pl2_is_space_member(space_id)) with check (pl2_is_space_member(space_id));
create policy "plans: members can delete" on plans for delete using (pl2_is_space_member(space_id));

create table if not exists rituals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  label text not null,
  cadence text not null default 'Weekly',
  last_done_at timestamptz,
  created_at timestamptz not null default now()
);
alter table rituals enable row level security;
create policy "rituals: members can read" on rituals for select using (pl2_is_space_member(space_id));
create policy "rituals: members can write" on rituals for insert with check (pl2_is_space_member(space_id));
create policy "rituals: members can update" on rituals for update
  using (pl2_is_space_member(space_id)) with check (pl2_is_space_member(space_id));

-- ---------------------------------------------------------------------------
-- Realtime: let clients subscribe to their space's live changes
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table moments, signals, need_requests, letters, plans, space_members;

-- ---------------------------------------------------------------------------
-- Storage: moment photos, one bucket, path = "<space_id>/<file>"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('moment-photos', 'moment-photos', false)
  on conflict (id) do nothing;

create policy "moment-photos: members can read their space's photos"
  on storage.objects for select
  using (bucket_id = 'moment-photos' and pl2_is_space_member((storage.foldername(name))[1]::uuid));
create policy "moment-photos: members can upload to their space"
  on storage.objects for insert
  with check (bucket_id = 'moment-photos' and pl2_is_space_member((storage.foldername(name))[1]::uuid));
create policy "moment-photos: uploader can delete"
  on storage.objects for delete
  using (bucket_id = 'moment-photos' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Account deletion — settings.html tells the person plainly that deleting
-- their account deletes their own memories, but NOT their partner's account
-- or the memories the partner created. Cascade FKs above already ensure that
-- (moments/signals/need_requests/letters/plans.by → profiles.id ON DELETE
-- CASCADE removes only this person's own rows; the space and the partner's
-- rows are untouched). This just removes the auth.users row itself, which
-- cascades to profiles → space_members → everything above.
-- ---------------------------------------------------------------------------
create or replace function pl2_delete_own_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  delete from auth.sessions where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function pl2_delete_own_account() to authenticated;

-- ============================================================================
-- Done. Next: Settings → API in the Supabase dashboard → copy the Project URL
-- and the anon/public key (never the service_role key) into
-- app/pairlum-config.js in the Pairlum 2 project.
-- ============================================================================

-- Backfill profiles for existing auth accounts; no old app data is changed.
insert into profiles(id,name) select id,coalesce(raw_user_meta_data->>'name','') from auth.users on conflict do nothing;
-- Protect content ownership, routing, and letter integrity at the database boundary.
create or replace function pl2_guard_letter() returns trigger language plpgsql set search_path=public as $$
begin
 if new.by is distinct from old.by or new.space_id is distinct from old.space_id then raise exception 'cannot reassign letter'; end if;
 if old.by <> auth.uid() and (new.body is distinct from old.body or new.title is distinct from old.title or new.sealed_until is distinct from old.sealed_until) then raise exception 'only the author can edit a letter'; end if;
 if new.opened and old.sealed_until > current_date then raise exception 'letter_is_sealed'; end if;
 return new;
end $$;
create trigger pl2_guard_letter before update on letters for each row execute function pl2_guard_letter();
drop policy "letters: members can read" on letters;
create policy "letters: released or author" on letters for select to authenticated using (pl2_is_space_member(space_id) and (by=auth.uid() or sealed_until is null or sealed_until<=current_date));
alter function pl2_enforce_two_members() set search_path=public;
alter function pl2_enforce_moment_update_authorship() set search_path=public;
alter function pl2_enforce_need_update() set search_path=public;
alter function pl2_gen_invite_code() set search_path=public;
revoke all on profiles,spaces,space_members,moments,signals,need_requests,letters,plans,rituals from anon;
grant select,insert,update,delete on profiles,spaces,space_members,moments,signals,need_requests,letters,plans,rituals to authenticated;
revoke all on function pl2_create_space(date,boolean,text,text),pl2_accept_invite(text),pl2_delete_own_account(),pl2_is_space_member(uuid),pl2_lookup_invite(text),pl2_handle_new_user() from public,anon;
grant execute on function pl2_create_space(date,boolean,text,text),pl2_accept_invite(text),pl2_delete_own_account(),pl2_is_space_member(uuid),pl2_lookup_invite(text) to authenticated;
grant execute on function pl2_lookup_invite(text) to anon;
-- A profile must be deleted safely even after it responded to a partner request.
alter table need_requests drop constraint need_requests_responded_by_fkey;
alter table need_requests add constraint need_requests_responded_by_fkey foreign key(responded_by) references profiles(id) on delete set null;

update storage.buckets set file_size_limit=52428800,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/webm','video/quicktime'] where id='moment-photos';
