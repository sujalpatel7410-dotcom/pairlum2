-- ============================================================================
-- Migration: membership and Book eligibility come from the server only
--
-- Until now a couple's plan lived inside the shared record (spaces.data ->
-- membership), which either partner's app could write — so "Switch plan"
-- worked without paying, and the printed Book's one-year countdown was
-- worked out on the phone from a date the phone itself had written.
--
-- Now:
--   * public.memberships holds each space's plan. The app can READ it; no
--     app can write it. Only the service role (the future payment webhook)
--     or a founder in the SQL editor can.
--   * my_membership() returns the plan plus whether the Book is eligible,
--     worked out here, on the server: one full year on the Book plan.
--   * write_space_data ignores whatever "membership" the app sends and keeps
--     the stored value; create_space drops it from the seed.
--
-- No auto-renewal: a membership has a fixed end (started_at + 1 year), and
-- it simply ends unless a new one is bought.
--
-- To give a test space a plan by hand (SQL editor):
--   insert into public.memberships (space_id, plan, started_at, ends_at, source)
--   values ('<space id>', 'book', now(), now() + interval '1 year', 'manual')
--   on conflict (space_id) do update set plan = excluded.plan,
--     started_at = excluded.started_at, ends_at = excluded.ends_at,
--     source = excluded.source, updated_at = now();
--
-- Additive; no data is changed or deleted.
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. New projects: supabase/schema.sql includes it.
-- ============================================================================

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
-- No insert/update/delete policy and no write grants: only the service role
-- (which bypasses row-level security) or the SQL editor can change a plan.
revoke insert, update, delete, truncate on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;

-- The plan for target_space, with Book eligibility decided here. Returns no
-- row when the space has no membership (the free First Chapter) or the
-- caller isn't one of its members.
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
revoke execute on function public.my_membership(uuid) from public, anon;
grant execute on function public.my_membership(uuid) to authenticated;

-- Both devices hear about a plan change (e.g. after a payment) live.
do $$ begin
  alter publication supabase_realtime add table public.memberships;
exception when duplicate_object then null; end $$;

-- The shared record can no longer carry a plan the app wrote itself: keep
-- whatever is stored, ignore what's sent. (Same function as before
-- otherwise — active member + revision check.) Skipped once the newer guard
-- (20261019140000_guard.sql) is installed, so running this file again later
-- never puts back the older, unguarded version.
do $do$ begin
  if to_regproc('public.guard_space_data') is not null then return; end if;
  execute $fn$
create or replace function public.write_space_data(target_space uuid, new_data jsonb, expected_rev integer)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  result public.spaces;
begin
  if not public.is_active_member(target_space) then
    raise exception 'not an active member of this space — rejoin before making changes';
  end if;
  update public.spaces s
    set data = (new_data - 'membership')
               || case when s.data ? 'membership' then jsonb_build_object('membership', s.data -> 'membership') else '{}'::jsonb end,
        rev = s.rev + 1, updated_at = now()
    where s.id = target_space and s.rev = expected_rev
    returning * into result;
  return result;
end;
$$;
  $fn$;
end $do$;

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
