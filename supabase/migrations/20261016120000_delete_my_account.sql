-- ============================================================================
-- Migration: "Delete my account" actually deletes the account
--
-- Until now, Settings → Privacy → Delete my account removed the person's
-- content from the shared space and from their device, but their Supabase
-- login and membership stayed — they could still sign in. This adds the
-- server half: one function that, for the signed-in caller only,
--   1. ends every pairing they're part of, the same way "Disconnect" does
--      (both members become 'disconnected'; the space and the partner's
--      content are kept, nothing of the partner's is erased), and
--   2. deletes their login (auth.users), which also removes their
--      membership rows and any invites they created.
-- The app removes the person's own moments, notes, media etc. BEFORE calling
-- this, while they still have access.
--
-- Additive: creates one function, changes no existing objects.
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. New projects: supabase/schema.sql includes it.
-- ============================================================================

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Please sign in first.'; end if;

  update public.space_members set status = 'disconnected'
    where space_id in (select space_id from public.space_members where user_id = me);

  -- References to this account that have no ON DELETE rule would block the
  -- delete below; clear them instead (the rows themselves are kept).
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

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
