-- ============================================================
-- sirgaZ RLS helper functions
-- SECURITY DEFINER avoids recursive RLS evaluation when policies
-- need to ask whether the current user belongs to an event/match.
-- ============================================================

create or replace function public.is_event_participant(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants
    where event_id = p_event_id and user_id = p_user_id
  );
$$;

create or replace function public.is_venue_owner(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.id = p_event_id and v.owner_id = p_user_id
  );
$$;

create or replace function public.is_match_participant(p_match_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where id = p_match_id and (user_a = p_user_id or user_b = p_user_id)
  );
$$;

revoke all on function public.is_event_participant(uuid, uuid) from public;
revoke all on function public.is_venue_owner(uuid, uuid) from public;
revoke all on function public.is_match_participant(uuid, uuid) from public;
grant execute on function public.is_event_participant(uuid, uuid) to authenticated;
grant execute on function public.is_venue_owner(uuid, uuid) to authenticated;
grant execute on function public.is_match_participant(uuid, uuid) to authenticated;

-- Replace recursive policies with helper calls.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  auth.uid() = id
  or exists (
    select 1 from public.event_participants ep
    where ep.user_id = auth.uid()
      and public.is_event_participant(ep.event_id, profiles.id)
  )
  or exists (
    select 1 from public.events e
    where public.is_venue_owner(e.id)
      and public.is_event_participant(e.id, profiles.id)
  )
);

drop policy if exists participants_read on public.event_participants;
create policy participants_read on public.event_participants for select using (
  auth.uid() = user_id
  or public.is_event_participant(event_id)
  or public.is_venue_owner(event_id)
);

-- Ensure match reads remain scoped to the two matched users.
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (
  auth.uid() = user_a or auth.uid() = user_b
);

-- Missions are only accessible to the matched pair.
drop policy if exists missions_read on public.missions;
create policy missions_read on public.missions for select using (
  public.is_match_participant(match_id)
);

drop policy if exists missions_write on public.missions;
create policy missions_write on public.missions for insert with check (
  public.is_match_participant(match_id)
);

drop policy if exists missions_update on public.missions;
create policy missions_update on public.missions for update using (
  public.is_match_participant(match_id)
) with check (
  public.is_match_participant(match_id)
);

-- Messages use the same match-scoped helper.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (
  public.is_match_participant(match_id)
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_match_participant(match_id)
);
