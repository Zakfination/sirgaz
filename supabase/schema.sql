-- ============================================================
-- sirgaZ Supabase schema — paste into Supabase SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

-- 1. VENUES (owned by admin/venue users)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz default now()
);

-- 2. EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  description text,
  banner_url text,
  venue_name text,
  starts_at timestamptz,
  status text default 'draft', -- draft | published | live | ended
  capacity int default 200,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- 3. USER PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  bio text,
  avatar_url text,
  interests text[] default '{}',
  personality jsonb default '{}',
  goal text,
  xp int default 0,
  created_at timestamptz default now()
);

-- 4. EVENT PARTICIPANTS
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  status text default 'waiting', -- waiting | matched | left
  unique (event_id, user_id)
);

-- 5. MATCHES
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  score int default 0,
  breakdown jsonb default '{}',
  created_at timestamptz default now(),
  unique (event_id, user_a, user_b)
);

-- 6. MISSIONS
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  title text,
  clues jsonb default '[]',
  reward_xp int default 100,
  reward_title text,
  status text default 'active', -- active | complete | expired
  created_at timestamptz default now()
);

-- 7. REWARDS
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  title text not null,
  description text,
  code text unique default encode(gen_random_bytes(6), 'hex'),
  xp int default 0,
  redeemed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.event_participants enable row level security;
alter table public.matches enable row level security;
alter table public.missions enable row level security;
alter table public.rewards enable row level security;

-- Drop existing policies if re-running
do $$ begin
  execute (select string_agg('drop policy if exists ' || quote_ident(policyname) || ' on public.' || quote_ident(tablename) || ';', ' ')
    from pg_policies where schemaname='public');
exception when others then null; end $$;

-- VENUES: public read, owner write
create policy venues_read on public.venues for select using (true);
create policy venues_owner_insert on public.venues for insert with check (auth.uid() = owner_id);
create policy venues_owner_update on public.venues for update using (auth.uid() = owner_id);
create policy venues_owner_delete on public.venues for delete using (auth.uid() = owner_id);

-- EVENTS: public read, venue owner writes
create policy events_read on public.events for select using (true);
create policy events_owner_all on public.events for all
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- PROFILES: public read, self write
create policy profiles_read on public.profiles for select using (true);
create policy profiles_self_upsert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);

-- PARTICIPANTS: public read (for counts), self write
create policy participants_read on public.event_participants for select using (true);
create policy participants_self_insert on public.event_participants for insert with check (auth.uid() = user_id);
create policy participants_self_update on public.event_participants for update using (auth.uid() = user_id);

-- MATCHES: participants only
create policy matches_read on public.matches for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy matches_insert on public.matches for insert with check (auth.uid() = user_a or auth.uid() = user_b);

-- MISSIONS: participants of the match
create policy missions_read on public.missions for select using (
  exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);
create policy missions_write on public.missions for insert with check (
  exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);
create policy missions_update on public.missions for update using (
  exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);

-- REWARDS: self only
create policy rewards_self_read on public.rewards for select using (auth.uid() = user_id);
create policy rewards_self_write on public.rewards for insert with check (auth.uid() = user_id);
create policy rewards_self_update on public.rewards for update using (auth.uid() = user_id);

-- Realtime enable
alter publication supabase_realtime add table public.event_participants;
alter publication supabase_realtime add table public.matches;
