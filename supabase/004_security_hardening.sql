-- ============================================================
-- sirgaZ P0 Security Hardening
-- Event-scoped RLS: users should only see profiles/participants
-- relevant to an event they joined, plus venue-owner visibility.
-- ============================================================

-- PROFILES -----------------------------------------------------
drop policy if exists profiles_read on public.profiles;

create policy profiles_read on public.profiles
for select using (
  auth.uid() = id
  or exists (
    select 1
    from public.event_participants me
    join public.event_participants them
      on them.event_id = me.event_id
    where me.user_id = auth.uid()
      and them.user_id = profiles.id
  )
  or exists (
    select 1
    from public.events e
    join public.venues v on v.id = e.venue_id
    join public.event_participants p on p.event_id = e.id
    where v.owner_id = auth.uid()
      and p.user_id = profiles.id
  )
);

-- EVENT PARTICIPANTS ------------------------------------------
drop policy if exists participants_read on public.event_participants;

create policy participants_read on public.event_participants
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.event_participants me
    where me.event_id = event_participants.event_id
      and me.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.id = event_participants.event_id
      and v.owner_id = auth.uid()
  )
);

-- Prevent a participant from changing another user's status.
-- The existing self-update policy remains valid.

-- MATCHES ------------------------------------------------------
-- A caller may create a match only when they are a participant in
-- the event and both users are participants in that same event.
drop policy if exists matches_insert on public.matches;

create policy matches_insert on public.matches
for insert with check (
  exists (
    select 1
    from public.event_participants p
    where p.event_id = matches.event_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.event_participants p
    where p.event_id = matches.event_id
      and p.user_id = matches.user_a
  )
  and exists (
    select 1
    from public.event_participants p
    where p.event_id = matches.event_id
      and p.user_id = matches.user_b
  )
  and matches.user_a <> matches.user_b
  and (auth.uid() = matches.user_a or auth.uid() = matches.user_b)
);

-- REWARDS ------------------------------------------------------
-- Reward creation remains self-only. Redemption must be performed
-- by the venue owner of the event, not by the reward owner/browser.
drop policy if exists rewards_self_update on public.rewards;

create policy rewards_venue_redeem on public.rewards
for update using (
  exists (
    select 1
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.id = rewards.event_id
      and v.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.id = rewards.event_id
      and v.owner_id = auth.uid()
  )
);

-- INDEXES ------------------------------------------------------
create index if not exists event_participants_event_user_idx
  on public.event_participants (event_id, user_id);

create index if not exists matches_event_users_idx
  on public.matches (event_id, user_a, user_b);

create index if not exists events_venue_idx
  on public.events (venue_id);

create index if not exists rewards_event_code_idx
  on public.rewards (event_id, code);
