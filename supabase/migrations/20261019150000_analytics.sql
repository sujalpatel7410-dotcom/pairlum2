-- ============================================================================
-- Migration: content-free product analytics
--
-- Eleven named events and nothing else: no words, captions, photos, voice,
-- names or free-form details. Each row is only (event, who, which space,
-- when). The app can add an event through track_event() but can never read
-- any back; founders read them in the SQL editor. For example, a day-by-day
-- count:
--   select date_trunc('day', at) as day, name, count(*) as events,
--          count(distinct user_id) as people
--   from public.analytics_events group by 1, 2 order by 1 desc, 2;
--
-- Recorded by the database itself, so the app can't fake or forget them:
--   signup_completed  a login is created (once per person)
--   space_created     someone starts their space
--   invite_sent       an invite link is made
--   partner_joined    the second person joins a space (once per space)
-- Sent by the app:
--   signup_started        the sign-up form is sent — the only event allowed
--                         before signing in
--   first_memory_created  someone adds their first moment or memory (once
--                         per person)
--   pricing_viewed        the membership screen is opened
--   upgrade_clicked       "How to get yours" on the Book teaser, without a
--                         Book plan
-- Defined, not sent yet (they wait for the First Chapter reveal and for
-- payments): first_chapter_completed, checkout_started, purchase_completed
-- (purchase_completed will come from the payment webhook, never the app).
--
-- Deleting an account keeps its events but forgets whose they were
-- (user_id becomes empty), so totals stay right and nothing points back to
-- the person. Counting never gets in the way: if an event can't be stored,
-- the sign-up, space or invite it describes still goes ahead.
--
-- Additive; nothing existing is changed or deleted.
-- Apply: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. New projects: supabase/schema.sql includes it.
-- ============================================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null check (name in (
    'signup_started', 'signup_completed', 'space_created', 'invite_sent', 'partner_joined',
    'first_memory_created', 'first_chapter_completed', 'pricing_viewed', 'upgrade_clicked',
    'checkout_started', 'purchase_completed')),
  user_id uuid references auth.users(id) on delete set null,
  space_id uuid references public.spaces(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists analytics_events_name_at on public.analytics_events (name, at);
create index if not exists analytics_events_user_name on public.analytics_events (user_id, name);
alter table public.analytics_events enable row level security;
-- No policies on purpose: no app, signed in or not, reads or writes rows.
revoke all on public.analytics_events from anon, authenticated;

-- Stores one event. Internal: only the functions below call it.
create or replace function public.analytics_record(event_name text, who uuid, target_space uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if event_name in ('signup_completed', 'first_memory_created', 'first_chapter_completed') and who is not null
     and exists (select 1 from public.analytics_events where name = event_name and user_id = who) then
    return; -- once per person
  end if;
  if event_name = 'partner_joined' and target_space is not null
     and exists (select 1 from public.analytics_events where name = event_name and space_id = target_space) then
    return; -- once per space
  end if;
  insert into public.analytics_events (name, user_id, space_id) values (event_name, who, target_space);
exception when others then
  null; -- counting must never stop the thing being counted
end;
$$;
revoke execute on function public.analytics_record(text, uuid, uuid) from public, anon, authenticated;

-- What the app may send. Only the event's name: who and which space are
-- worked out here.
create or replace function public.track_event(event_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  sp uuid;
begin
  if event_name is null or event_name not in ('signup_started', 'first_memory_created', 'pricing_viewed',
      'upgrade_clicked', 'first_chapter_completed', 'checkout_started') then
    raise exception 'Pairlum doesn''t count that.';
  end if;
  if me is null then
    if event_name <> 'signup_started' then raise exception 'Please sign in first.'; end if;
    -- a light brake on a flood from signed-out visitors
    if (select count(*) from public.analytics_events
        where name = 'signup_started' and user_id is null and at > now() - interval '1 minute') >= 120 then
      return;
    end if;
    perform public.analytics_record(event_name, null, null);
    return;
  end if;
  -- the same tap counted once, not again for a double tap or a retry
  if exists (select 1 from public.analytics_events
             where name = event_name and user_id = me and at > now() - interval '10 seconds') then
    return;
  end if;
  select space_id into sp from public.space_members where user_id = me and status = 'active' limit 1;
  perform public.analytics_record(event_name, me, sp);
end;
$$;
revoke execute on function public.track_event(text) from public;
grant execute on function public.track_event(text) to anon, authenticated;

-- The events the database records itself.
create or replace function public.analytics_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.analytics_record('signup_completed', new.id, null);
  return new;
end;
$$;
create or replace function public.analytics_on_space()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.analytics_record('space_created', auth.uid(), new.id);
  return new;
end;
$$;
create or replace function public.analytics_on_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.analytics_record('invite_sent', new.created_by, new.space_id);
  return new;
end;
$$;
create or replace function public.analytics_on_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.analytics_record('partner_joined', new.user_id, new.space_id);
  return new;
end;
$$;
revoke execute on function public.analytics_on_signup() from public, anon, authenticated;
revoke execute on function public.analytics_on_space() from public, anon, authenticated;
revoke execute on function public.analytics_on_invite() from public, anon, authenticated;
revoke execute on function public.analytics_on_join() from public, anon, authenticated;

drop trigger if exists pairlum_analytics_signup on auth.users;
create trigger pairlum_analytics_signup after insert on auth.users
  for each row execute function public.analytics_on_signup();
drop trigger if exists pairlum_analytics_space on public.spaces;
create trigger pairlum_analytics_space after insert on public.spaces
  for each row execute function public.analytics_on_space();
drop trigger if exists pairlum_analytics_invite on public.pairing_invites;
create trigger pairlum_analytics_invite after insert on public.pairing_invites
  for each row execute function public.analytics_on_invite();
drop trigger if exists pairlum_analytics_join on public.space_members;
create trigger pairlum_analytics_join after insert on public.space_members
  for each row when (new.role = 'b') execute function public.analytics_on_join();
