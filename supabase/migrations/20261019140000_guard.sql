-- ============================================================================
-- Migration: the server enforces who may change what in the shared record
--
-- Both partners save into one shared record (spaces.data). Until now the
-- server accepted any change from either of them, so "only the author can
-- edit or delete a Moment" (and similar rules) held only inside the app.
-- write_space_data now checks every save against the stored version:
--
--   * Items (moments, notes, letters, memories, plans, replies, dates,
--     someday, requests, live-listening log, rituals, collections and their
--     entries): nobody can remove the other person's item, change it beyond
--     what the app legitimately allows, re-credit it, or add an item in the
--     other person's name. Allowed partner changes are exactly the app's own:
--       someday  — tick "done";
--       requests — answer an "I Need You" request (reply, replyAt);
--       chapters — edit or remove (chapters belong to both of you);
--       rituals  — mark one done (count, last);
--       collections — add your own entries to the other person's collection.
--   * Per-person entries — profile, settings, sleep, facts, comfort, sound,
--     feelings, daily answers, hearts, reactions, quiz answers, Our DNA
--     answers, (future) favourites and hidden — only their owner can change.
--   * A recording's write-up can only be changed from its author's side.
--   * Items soft-deleted more than 30 days ago (Recently Deleted) may be
--     cleared by either of you.
--   * Before a partner has joined, the creator may write anything.
--
-- A save that breaks a rule is not refused: the other person's version of
-- just those pieces is put back and everything else is saved. (Refusing it
-- would leave the phone retrying the same save forever.) The app compares
-- what was stored with what it sent and tells the person.
--
-- Additive: new helper functions + a new write_space_data. No data changes.
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. New projects: supabase/schema.sql includes it.
-- ============================================================================

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
