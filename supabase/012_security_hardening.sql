-- sirgaZ 012: security hardening
-- Fixes found in the Nov 2026 audit. Idempotent; run after 011.
--
--  1. profiles were readable by every authenticated user (011 re-added using(true)).
--  2. has_role(role, NULL) meant "any venue", so can_manage_venue(NULL) was true for
--     every venue admin. Policies that looked up events.venue_id through RLS got NULL
--     for draft/ended events and leaked participants + matches of other venues.
--  3. XP guard trigger never fired (NULL <> '1' is NULL), and INSERT was unguarded,
--     so users could set their own XP.
--  4. Participants could rewrite their own event_participants row (event_id, joined_at).
--  5. count_event_participants RPC was called by the frontend but never defined.
--  6. profiles_self_or_match_read compared against matches.id instead of profiles.id.
begin;

-- ------------------------------------------------------------
-- Role helpers: NULL venue now only matches global (venue-less) roles.
-- ------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role, p_venue uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role = p_role and venue_id is not distinct from p_venue
  );
$$;

-- Event-scoped staff check that reads events without going through RLS.
create or replace function public.can_manage_event(p_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select public.can_manage_venue(e.venue_id) from public.events e where e.id = p_event), false);
$$;
revoke all on function public.can_manage_event(uuid) from public;
grant execute on function public.can_manage_event(uuid) to authenticated;

-- Is p_user a participant of an event this caller can manage? (venue staff roster view)
create or replace function public.is_participant_of_my_venue(p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.event_participants ep
    join public.events e on e.id = ep.event_id
    where ep.user_id = p_user and public.can_manage_venue(e.venue_id)
  );
$$;
revoke all on function public.is_participant_of_my_venue(uuid) from public;
grant execute on function public.is_participant_of_my_venue(uuid) to authenticated;

-- ------------------------------------------------------------
-- Profiles: self, matched peer, venue staff of an event they joined, super admin.
-- (013 extends this with the current random-match peer.)
-- ------------------------------------------------------------
drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_self_or_match_read on public.profiles;
drop policy if exists profiles_read_scoped on public.profiles;
create policy profiles_read_scoped on public.profiles for select to authenticated using(
  profiles.id = (select auth.uid())
  or public.is_super_admin()
  or exists(
    select 1 from public.matches m
    where (m.user_a = (select auth.uid()) and m.user_b = profiles.id)
       or (m.user_b = (select auth.uid()) and m.user_a = profiles.id)
  )
  or public.is_participant_of_my_venue(profiles.id)
);

-- ------------------------------------------------------------
-- Participants / matches: staff check via can_manage_event (no NULL leak).
-- Participants can no longer update their own row; check-in RPC owns writes.
-- ------------------------------------------------------------
drop policy if exists participants_read_authenticated on public.event_participants;
create policy participants_read_authenticated on public.event_participants for select to authenticated
  using((select auth.uid()) = user_id or public.can_manage_event(event_id));
drop policy if exists participants_self_update_authenticated on public.event_participants;
drop policy if exists participants_self_update on public.event_participants;

drop policy if exists matches_read_authenticated on public.matches;
create policy matches_read_authenticated on public.matches for select to authenticated
  using((select auth.uid()) = user_a or (select auth.uid()) = user_b or public.can_manage_event(event_id));

-- ------------------------------------------------------------
-- Server-controlled profile fields.
-- SECURITY INVOKER on purpose: current_user is the API role (anon/authenticated)
-- for direct client writes, and the function owner inside SECURITY DEFINER RPCs.
-- ------------------------------------------------------------
create or replace function public.guard_profile_server_fields()
returns trigger language plpgsql set search_path=public as $$
declare has_susp boolean := to_jsonb(new) ? 'suspended_at';
        has_gender boolean := to_jsonb(new) ? 'gender';
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.xp := 0;
    if has_susp then new.suspended_at := null; end if;
    return new;
  end if;
  if new.xp is distinct from old.xp then raise exception 'XP_SERVER_CONTROLLED'; end if;
  -- columns added by 013; checked only when present so this file can be re-run in any order
  if has_susp and new.suspended_at is distinct from old.suspended_at then
    raise exception 'SUSPENSION_SERVER_CONTROLLED';
  end if;
  if has_gender and old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'GENDER_LOCKED';
  end if;
  return new;
end; $$;
drop trigger if exists guard_profile_server_fields on public.profiles;
create trigger guard_profile_server_fields before insert or update on public.profiles
  for each row execute function public.guard_profile_server_fields();

-- ------------------------------------------------------------
-- QR secret generation: encode(..., 'base64url') only exists in PostgreSQL 18+, so on
-- Supabase (PG 15/17) create_venue_access_token always failed and nobody could check in.
-- ------------------------------------------------------------
create or replace function public.create_venue_access_token(p_event uuid,p_label text default 'Venue QR',p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path=public
as $$
declare e public.events%rowtype; raw text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into e from public.events where id=p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not public.is_venue_admin(e.venue_id) then raise exception 'VENUE_ADMIN_REQUIRED'; end if;
  raw:=rtrim(translate(encode(gen_random_bytes(24),'base64'),'+/','-_'),'=');
  insert into public.venue_access_tokens(venue_id,event_id,token_hash,label,expires_at,created_by)
  values(e.venue_id,p_event,encode(digest(raw,'sha256'),'hex'),coalesce(p_label,'Venue QR'),p_expires_at,auth.uid());
  insert into public.audit_logs(actor_id,venue_id,event_id,action,entity_type) values(auth.uid(),e.venue_id,p_event,'venue.access_token_created','venue_access_token');
  return raw;
end; $$;
revoke all on function public.create_venue_access_token(uuid,text,timestamptz) from public;
grant execute on function public.create_venue_access_token(uuid,text,timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Participant count (non-sensitive aggregate) for public/live events or staff.
-- ------------------------------------------------------------
create or replace function public.count_event_participants(p_event uuid)
returns integer language plpgsql stable security definer set search_path=public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event;
  if not found then return 0; end if;
  if e.status not in ('published', 'live') and not public.can_manage_venue(e.venue_id) then
    return 0;
  end if;
  return (select count(*)::integer from public.event_participants
          where event_id = p_event and coalesce(status, 'waiting') <> 'left');
end; $$;
revoke all on function public.count_event_participants(uuid) from public;
grant execute on function public.count_event_participants(uuid) to anon, authenticated;

commit;
