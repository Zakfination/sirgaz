-- ============================================================
-- sirgaZ Chat migration — paste into Supabase SQL Editor → Run
-- Safe/idempotent: uses IF NOT EXISTS everywhere.
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Index for fast history lookup per match, ordered by time
create index if not exists messages_match_created_idx
  on public.messages (match_id, created_at);

alter table public.messages enable row level security;

-- Drop old policies if re-running this file
drop policy if exists messages_read on public.messages;
drop policy if exists messages_insert on public.messages;

-- MESSAGES: only the two participants of the match can read
create policy messages_read on public.messages for select using (
  exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

-- MESSAGES: only a participant can insert, and only as themselves
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

-- Realtime enable, so chat updates live without polling
alter publication supabase_realtime add table public.messages;