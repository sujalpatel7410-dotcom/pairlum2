-- ============================================================================
-- Migration: close three ways around the app's own security checks
--
-- 1. The shared record (public.spaces) could be updated directly through the
--    REST API by any member — including one who had left or disconnected —
--    skipping write_space_data's active-member and revision checks. Now the
--    only way to change it is write_space_data.
-- 2. Any member (again including left/disconnected ones) could overwrite or
--    delete ANY photo, clip or voice note in their space's storage folder.
--    Now: anyone in the space can still view (history stays readable after
--    leaving), only active members can add files, and only a file's own
--    uploader can replace or delete it.
-- 3. The live "signal" channel ("I Need You" live listening, hold-the-heart)
--    was a public Realtime channel: anyone who knew a space's id could
--    listen in or send into it. Now it's private: only that space's members
--    can receive, and only active members can send. (The app switches the
--    channel to private in the same release — run this migration BEFORE
--    loading the new app code, or live updates won't connect.)
--
-- Nothing is deleted; no data changes.
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. New projects: supabase/schema.sql includes it.
-- ============================================================================

-- 1. ------------------------------------------------------------------------
drop policy if exists "members can update their space" on public.spaces;
-- Supabase grants every new table to anon/authenticated by default; row-level
-- security already refuses these writes, this removes the grants too.
revoke insert, update, delete, truncate on public.spaces, public.space_members, public.pairing_invites from anon, authenticated;

-- Functions that run with elevated rights should never look names up in a
-- schema a caller could influence.
alter function public.is_space_member(uuid) set search_path = public;
alter function public.is_active_member(uuid) set search_path = public;
alter function public.create_space(jsonb) set search_path = public;
alter function public.write_space_data(uuid, jsonb, integer) set search_path = public;
alter function public.leave_space(uuid) set search_path = public;
alter function public.rejoin_space(uuid) set search_path = public;
alter function public.disconnect_space(uuid) set search_path = public;

-- 2. ------------------------------------------------------------------------
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

-- Deleting your own file stays possible after stepping away (e.g. while
-- deleting your account), so this needs membership, not active membership.
drop policy if exists "space members can delete their media" on storage.objects;
create policy "space members can delete their media" on storage.objects
  for delete using (bucket_id = 'media' and public.is_space_member((storage.foldername(name))[1]::uuid)
         and (owner_id = auth.uid()::text or owner = auth.uid()));

-- 3. ------------------------------------------------------------------------
-- Topic "space-<space id>" is the channel pairlum-backend.js subscribes to.
-- Receiving: members who are active or have stepped away (their history
-- still updates live). Sending: active members only.
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
