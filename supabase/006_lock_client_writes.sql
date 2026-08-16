-- P0: mission and reward creation/completion are now server-authorized.
drop policy if exists missions_write on public.missions;
drop policy if exists missions_update on public.missions;
drop policy if exists rewards_self_write on public.rewards;

-- Keep reward reads self-only and venue redemption server-authorized.
-- No authenticated client can mint a reward or directly complete a mission.
