-- sirgaZ 013: PRD V2 phase 1 — random matchmaking, reroll quota, block & report.
-- Maps the PRD's MongoDB collections onto Supabase/Postgres:
--   user_profiles        -> profiles (+ gender, suspended_at) / profile_private (+ seeking)
--   event_match_sessions -> public.event_match_sessions
--   event_match_history  -> public.event_match_history
--   event_wallets        -> public.event_wallets
--   wallet_transactions  -> public.wallet_transactions
--   user_blocks          -> public.user_blocks
--   chat_reports         -> public.user_reports
-- Payments (Midtrans), chat unlocks, conversations and pokes are phase 2.
-- All writes go through SECURITY DEFINER RPCs; clients only get scoped SELECT.
-- Run after 012. Idempotent.
begin;

-- ============================================================
-- 1. Profile & event fields
-- ============================================================
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists suspended_at timestamptz;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'profiles_gender_check') then
    alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('male','female'));
  end if;
end $$;

alter table public.profile_private add column if not exists seeking text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'profile_private_seeking_check') then
    alter table public.profile_private add constraint profile_private_seeking_check check (seeking is null or seeking in ('male','female','any'));
  end if;
end $$;

-- Per-event match & monetization settings (PRD §11: admin-configurable; integer rupiah).
alter table public.events add column if not exists ends_at timestamptz;
alter table public.events add column if not exists free_rerolls integer not null default 3;
alter table public.events add column if not exists reroll_pack_size integer not null default 10;
alter table public.events add column if not exists reroll_pack_price_idr integer not null default 10000;
alter table public.events add column if not exists chat_unlock_price_idr integer not null default 49000;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'events_match_settings_check') then
    alter table public.events add constraint events_match_settings_check check (
      free_rerolls between 0 and 100 and reroll_pack_size between 1 and 1000
      and reroll_pack_price_idr >= 0 and chat_unlock_price_idr >= 0);
  end if;
end $$;

-- xp / suspended_at are server-controlled and gender is set once: enforced by
-- guard_profile_server_fields() from 012.

-- ============================================================
-- 2. Tables
-- ============================================================
create table if not exists public.event_match_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_match_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'MATCHING'
    check (status in ('MATCHING','MATCH_ACTIVE','EVENT_ENDED','SESSION_CLOSED')),
  match_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.event_match_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  matched_user_id uuid not null references auth.users(id) on delete cascade,
  match_number integer not null,
  match_source text not null check (match_source in ('INITIAL','FREE_REROLL','PAID_REROLL','AUTO_REPLACE')),
  created_at timestamptz not null default now()
);
create index if not exists event_match_history_user_idx on public.event_match_history(event_id, user_id, created_at desc);
create index if not exists event_match_history_matched_idx on public.event_match_history(event_id, matched_user_id);

create table if not exists public.event_wallets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  free_rerolls_total integer not null,
  free_rerolls_used integer not null default 0,
  paid_rerolls_remaining integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  check (free_rerolls_used between 0 and free_rerolls_total),
  check (paid_rerolls_remaining >= 0)
);

-- Append-only ledger. Balance in event_wallets must always equal the sum of deltas.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.event_wallets(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('FREE_GRANT','FREE_USE','PAID_GRANT','PAID_USE','EXPIRE','ADJUST')),
  free_delta integer not null default 0,
  paid_delta integer not null default 0,
  idempotency_key text unique,
  reference_type text,
  reference_id text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_wallet_idx on public.wallet_transactions(wallet_id, created_at);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','fake_profile','inappropriate_content','underage','safety_concern','other')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWED','ACTION_TAKEN','DISMISSED')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index if not exists user_reports_status_idx on public.user_reports(status, created_at desc);

-- ============================================================
-- 3. Internal helpers (not granted to clients)
-- ============================================================
create or replace function public._safe_date(p text)
returns date language plpgsql immutable as $$
begin return p::date; exception when others then return null; end; $$;

create or replace function public._user_age(p_user uuid)
returns integer language sql stable security definer set search_path=public as $$
  select extract(year from age(coalesce(pp.birthday, public._safe_date(p.personality->>'birthday'))))::integer
  from public.profiles p left join public.profile_private pp on pp.user_id = p.id
  where p.id = p_user;
$$;

-- PRD §3A: name, age (18+), gender, photo, interests, preference.
create or replace function public._profile_complete(p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p join public.profile_private pp on pp.user_id = p.id
    where p.id = p_user
      and nullif(trim(p.name), '') is not null
      and p.gender is not null
      and pp.seeking is not null
      and nullif(p.avatar_url, '') is not null
      and p.avatar_url !~* 'pravatar\.cc'  -- legacy random stock faces are not real photos
      and coalesce(array_length(p.interests, 1), 0) >= 1
      and coalesce(public._user_age(p_user), 0) >= 18
  );
$$;

create or replace function public._is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_blocks
                where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public._event_open(e public.events)
returns boolean language sql stable as $$
  select e.status = 'live' and (e.ends_at is null or e.ends_at > now());
$$;

-- Is candidate c a valid match for user u in event ev right now? (PRD §4)
create or replace function public._is_eligible_match(p_event uuid, u uuid, c uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select c is not null and c <> u
    and exists(select 1 from public.event_participants ep
               where ep.event_id = p_event and ep.user_id = c and coalesce(ep.status,'waiting') <> 'left')
    and exists(select 1 from public.venue_sessions vs
               where vs.event_id = p_event and vs.user_id = c and vs.status = 'active' and vs.expires_at > now())
    and public._profile_complete(c)
    and not public._is_blocked_pair(u, c)
    and exists(
      select 1
      from public.profiles me join public.profile_private mepp on mepp.user_id = me.id,
           public.profiles cp join public.profile_private cpp on cpp.user_id = cp.id
      where me.id = u and cp.id = c
        and cp.suspended_at is null
        and (mepp.seeking = 'any' or mepp.seeking = cp.gender)
        and (cpp.seeking = 'any' or cpp.seeking = me.gender)
    );
$$;

-- Uniform random pick among eligible candidates, optionally excluding one user.
create or replace function public._pick_random_candidate(p_event uuid, u uuid, p_exclude uuid default null)
returns uuid language sql volatile security definer set search_path=public as $$
  select ep.user_id from public.event_participants ep
  where ep.event_id = p_event
    and ep.user_id <> u
    and (p_exclude is null or ep.user_id <> p_exclude)
    and public._is_eligible_match(p_event, u, ep.user_id)
  order by random()
  limit 1;
$$;

-- Same heuristic as find_match (interests / energy / goal), 0..100. Display only.
create or replace function public._compatibility(a uuid, b uuid)
returns integer language plpgsql stable security definer set search_path=public as $$
declare ai text[]; bi text[]; ag text; bg text; ae int; be int; s int := 0; shared int;
begin
  select coalesce(interests,'{}'), coalesce(goal,'') into ai, ag from public.profiles where id = a;
  select coalesce(interests,'{}'), coalesce(goal,'') into bi, bg from public.profiles where id = b;
  select coalesce(energy,50) into ae from public.profile_private where user_id = a;
  select coalesce(energy,50) into be from public.profile_private where user_id = b;
  select count(*) into shared from unnest(ai) i where i = any(bi);
  s := least(40, shared * 10) + greatest(0, 30 - abs(coalesce(ae,50) - coalesce(be,50)) * 30 / 100)
       + case when ag <> '' and ag = bg then 30 else 0 end;
  return greatest(0, least(100, s));
end; $$;

create or replace function public._match_card(p_viewer uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select case when p.id is null then null else jsonb_build_object(
    'user_id', p.id,
    'name', p.name,
    'age', public._user_age(p.id),
    'gender', p.gender,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'interests', coalesce(to_jsonb(p.interests), '[]'::jsonb),
    'goal', p.goal,
    'personality', coalesce(p.personality, '{}'::jsonb) - 'birthday',
    'compatibility', public._compatibility(p_viewer, p.id)
  ) end
  from (select p_user as id) x left join public.profiles p on p.id = x.id;
$$;

create or replace function public._matchmaking_state(s public.event_match_sessions, p_used_source text default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'session_id', s.id,
    'event_id', s.event_id,
    'status', s.status,
    'match_count', s.match_count,
    'match', case when s.current_match_user_id is null then null
                  else public._match_card(s.user_id, s.current_match_user_id) end,
    'quota', jsonb_build_object(
      'free_remaining', greatest(0, w.free_rerolls_total - w.free_rerolls_used),
      'paid_remaining', w.paid_rerolls_remaining,
      'status', w.status,
      'expires_at', w.expires_at),
    'used_source', p_used_source)
  from public.event_wallets w
  where w.event_id = s.event_id and w.user_id = s.user_id;
$$;

-- Expire wallet + close sessions for an event (idempotent). Ledger records the forfeited quota.
create or replace function public._expire_event_quota(p_event uuid)
returns void language plpgsql security definer set search_path=public as $$
declare w public.event_wallets%rowtype;
begin
  for w in select * from public.event_wallets where event_id = p_event and status = 'ACTIVE' for update loop
    insert into public.wallet_transactions(wallet_id,event_id,user_id,kind,free_delta,paid_delta,idempotency_key,reference_type,reference_id)
    values (w.id, w.event_id, w.user_id, 'EXPIRE',
            -(w.free_rerolls_total - w.free_rerolls_used), -w.paid_rerolls_remaining,
            'expire:' || w.id, 'event', p_event::text)
    on conflict (idempotency_key) do nothing;
    update public.event_wallets
      set status = 'EXPIRED', free_rerolls_used = free_rerolls_total, paid_rerolls_remaining = 0, updated_at = now()
      where id = w.id;
  end loop;
  update public.event_match_sessions set status = 'EVENT_ENDED', updated_at = now()
    where event_id = p_event and status in ('MATCHING','MATCH_ACTIVE');
end; $$;

-- Shared preconditions. Returns the event row or raises a PRD error code.
create or replace function public._matchmaking_guard(p_event uuid)
returns public.events language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  select * into e from public.events where id = p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  -- Quota of ended events is unusable immediately; the ledger EXPIRE rows are written by
  -- close_event() or expire_ended_events() (a RAISE here would roll them back).
  if e.status = 'ended' or (e.ends_at is not null and e.ends_at <= now()) then
    raise exception 'EVENT_ENDED';
  end if;
  if not public._event_open(e) then raise exception 'EVENT_NOT_LIVE'; end if;
  if not exists(select 1 from public.event_participants
                where event_id = p_event and user_id = uid and coalesce(status,'waiting') <> 'left')
     or not public.has_active_venue_session(p_event) then
    raise exception 'NOT_EVENT_PARTICIPANT';
  end if;
  if exists(select 1 from public.profiles where id = uid and suspended_at is not null) then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if not public._profile_complete(uid) then raise exception 'PROFILE_INCOMPLETE'; end if;
  return e;
end; $$;

-- Single place that creates a wallet, so the FREE_GRANT ledger row is never skipped.
create or replace function public._ensure_wallet(p_event uuid, p_user uuid)
returns public.event_wallets language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; w public.event_wallets%rowtype;
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  insert into public.event_wallets(event_id, user_id, free_rerolls_total, expires_at)
  values (p_event, p_user, e.free_rerolls, e.ends_at)
  on conflict (event_id, user_id) do nothing
  returning * into w;
  if w.id is not null then
    insert into public.wallet_transactions(wallet_id,event_id,user_id,kind,free_delta,idempotency_key,reference_type,reference_id)
    values (w.id, p_event, p_user, 'FREE_GRANT', w.free_rerolls_total, 'free_grant:' || w.id, 'event', p_event::text);
  end if;
  select * into w from public.event_wallets where event_id = p_event and user_id = p_user for update;
  return w;
end; $$;

-- Lock (creating if needed) the caller's session + wallet; auto-fill / auto-replace the
-- current match for free when it is empty or no longer eligible. Never consumes quota.
create or replace function public._ensure_session(p_event uuid)
returns public.event_match_sessions language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; uid uuid := auth.uid(); s public.event_match_sessions%rowtype;
        w public.event_wallets%rowtype; c uuid; src text;
begin
  e := public._matchmaking_guard(p_event);

  w := public._ensure_wallet(p_event, uid);

  insert into public.event_match_sessions(event_id, user_id) values (p_event, uid)
  on conflict (event_id, user_id) do nothing;
  select * into s from public.event_match_sessions where event_id = p_event and user_id = uid for update;

  if s.current_match_user_id is null or not public._is_eligible_match(p_event, uid, s.current_match_user_id) then
    src := case when s.match_count = 0 then 'INITIAL' else 'AUTO_REPLACE' end;
    c := public._pick_random_candidate(p_event, uid, s.current_match_user_id);
    if c is not null then
      update public.event_match_sessions
        set current_match_user_id = c, status = 'MATCH_ACTIVE', match_count = match_count + 1, updated_at = now()
        where id = s.id returning * into s;
      insert into public.event_match_history(event_id,user_id,matched_user_id,match_number,match_source)
      values (p_event, uid, c, s.match_count, src);
    elsif s.current_match_user_id is not null or s.status <> 'MATCHING' then
      update public.event_match_sessions
        set current_match_user_id = null, status = 'MATCHING', updated_at = now()
        where id = s.id returning * into s;
    end if;
  end if;
  return s;
end; $$;

-- ============================================================
-- 4. Client RPCs (PRD §6.1)
-- ============================================================

-- POST /matchmaking/start — idempotent; reload never changes the current match.
create or replace function public.matchmaking_start(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.event_match_sessions%rowtype;
begin
  s := public._ensure_session(p_event);
  return public._matchmaking_state(s);
end; $$;

-- GET /matchmaking/current — same contract as start (keeps the client simple).
create or replace function public.matchmaking_current(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin return public.matchmaking_start(p_event); end; $$;

-- POST /matchmaking/reroll — free quota first, then paid. Atomic; retries with the same
-- idempotency key never spend twice.
create or replace function public.matchmaking_reroll(p_event uuid, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); s public.event_match_sessions%rowtype; w public.event_wallets%rowtype;
        prev public.wallet_transactions%rowtype; c uuid; src text; key text;
begin
  s := public._ensure_session(p_event);  -- locks the session row
  select * into w from public.event_wallets where event_id = p_event and user_id = uid for update;

  key := case when nullif(trim(p_idempotency_key), '') is null then null
              else 'reroll:' || uid || ':' || left(trim(p_idempotency_key), 100) end;
  if key is not null then
    select * into prev from public.wallet_transactions where idempotency_key = key;
    if found then
      return public._matchmaking_state(s, case prev.kind when 'FREE_USE' then 'FREE' else 'PAID' end);
    end if;
  end if;

  -- Nothing shown yet: the first match is free, not a reroll.
  if s.current_match_user_id is null then
    raise exception 'NO_CANDIDATE_AVAILABLE';
  end if;

  if w.status <> 'ACTIVE' then raise exception 'EVENT_ENDED'; end if;
  if w.free_rerolls_used < w.free_rerolls_total then src := 'FREE';
  elsif w.paid_rerolls_remaining > 0 then src := 'PAID';
  else raise exception 'REROLL_QUOTA_EXHAUSTED';
  end if;

  c := public._pick_random_candidate(p_event, uid, s.current_match_user_id);
  if c is null then raise exception 'NO_CANDIDATE_AVAILABLE'; end if;  -- no charge

  if src = 'FREE' then
    update public.event_wallets set free_rerolls_used = free_rerolls_used + 1, updated_at = now() where id = w.id;
  else
    update public.event_wallets set paid_rerolls_remaining = paid_rerolls_remaining - 1, updated_at = now() where id = w.id;
  end if;
  insert into public.wallet_transactions(wallet_id,event_id,user_id,kind,free_delta,paid_delta,idempotency_key,reference_type,reference_id,created_by)
  values (w.id, p_event, uid, case src when 'FREE' then 'FREE_USE' else 'PAID_USE' end,
          case src when 'FREE' then -1 else 0 end, case src when 'PAID' then -1 else 0 end,
          key, 'match_session', s.id::text, uid);

  update public.event_match_sessions
    set current_match_user_id = c, status = 'MATCH_ACTIVE', match_count = match_count + 1, updated_at = now()
    where id = s.id returning * into s;
  insert into public.event_match_history(event_id,user_id,matched_user_id,match_number,match_source)
  values (p_event, uid, c, s.match_count, case src when 'FREE' then 'FREE_REROLL' else 'PAID_REROLL' end);

  return public._matchmaking_state(s, src);
end; $$;

-- GET /matchmaking/quota (quota of an ended event reads as EXPIRED / 0 even before the sweep)
create or replace function public.matchmaking_quota(p_event uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(
    (select case when w.status = 'EXPIRED' or e.status = 'ended' or (e.ends_at is not null and e.ends_at <= now())
              then jsonb_build_object('free_remaining', 0, 'paid_remaining', 0, 'status', 'EXPIRED', 'expires_at', w.expires_at)
              else jsonb_build_object(
                'free_remaining', greatest(0, w.free_rerolls_total - w.free_rerolls_used),
                'paid_remaining', w.paid_rerolls_remaining, 'status', w.status, 'expires_at', w.expires_at) end
     from public.event_wallets w join public.events e on e.id = w.event_id
     where w.event_id = p_event and w.user_id = auth.uid()),
    jsonb_build_object('free_remaining', 0, 'paid_remaining', 0, 'status', 'NOT_STARTED', 'expires_at', null));
$$;

-- GET /matchmaking/history
create or replace function public.matchmaking_history(p_event uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'matched_user_id', h.matched_user_id, 'name', p.name, 'avatar_url', p.avatar_url,
           'match_number', h.match_number, 'match_source', h.match_source, 'created_at', h.created_at)
         order by h.created_at desc), '[]'::jsonb)
  from public.event_match_history h left join public.profiles p on p.id = h.matched_user_id
  where h.event_id = p_event and h.user_id = auth.uid();
$$;

-- GET /matchmaking/eligibility
create or replace function public.matchmaking_eligibility(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare uid uuid := auth.uid(); e public.events%rowtype; reasons text[] := '{}';
begin
  if uid is null then return jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('UNAUTHORIZED')); end if;
  select * into e from public.events where id = p_event;
  if not found then return jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('EVENT_NOT_FOUND')); end if;
  if e.status = 'ended' or (e.ends_at is not null and e.ends_at <= now()) then reasons := array_append(reasons, 'EVENT_ENDED');
  elsif not public._event_open(e) then reasons := array_append(reasons, 'EVENT_NOT_LIVE'); end if;
  if not exists(select 1 from public.event_participants where event_id = p_event and user_id = uid and coalesce(status,'waiting') <> 'left')
     or not public.has_active_venue_session(p_event) then reasons := array_append(reasons, 'NOT_EVENT_PARTICIPANT'); end if;
  if exists(select 1 from public.profiles where id = uid and suspended_at is not null) then reasons := array_append(reasons, 'ACCOUNT_SUSPENDED'); end if;
  if not public._profile_complete(uid) then reasons := array_append(reasons, 'PROFILE_INCOMPLETE'); end if;
  return jsonb_build_object('eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons));
end; $$;

-- Bridge to the existing mission/reward flow: materialise the current random match as a
-- matches row so create_mission_for_match / complete_mission keep working.
create or replace function public.matchmaking_confirm(p_event uuid)
returns public.matches language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); s public.event_match_sessions%rowtype; m public.matches%rowtype; a uuid; b uuid;
begin
  s := public._ensure_session(p_event);
  if s.current_match_user_id is null then raise exception 'NO_CANDIDATE_AVAILABLE'; end if;
  a := least(uid, s.current_match_user_id); b := greatest(uid, s.current_match_user_id);
  select * into m from public.matches where event_id = p_event and least(user_a,user_b) = a and greatest(user_a,user_b) = b limit 1;
  if found then return m; end if;
  insert into public.matches(event_id,user_a,user_b,score,breakdown)
  values (p_event, a, b, public._compatibility(a, b), jsonb_build_object('source','random_match'))
  returning * into m;
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id) values (uid, p_event, 'match.confirmed', 'match', m.id);
  return m;
end; $$;

-- ============================================================
-- 5. Block & report (PRD §6.4, required from MVP)
-- ============================================================
create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_user is null or p_user = uid then raise exception 'INVALID_TARGET'; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (uid, p_user) on conflict do nothing;
  -- Drop each other from current matches; next start/current call refills for free.
  update public.event_match_sessions
    set current_match_user_id = null, status = 'MATCHING', updated_at = now()
    where (user_id = uid and current_match_user_id = p_user)
       or (user_id = p_user and current_match_user_id = uid);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values (uid, 'user.blocked', 'user', p_user);
end; $$;

create or replace function public.unblock_user(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
end; $$;

create or replace function public.report_user(
  p_user uuid, p_reason text, p_details text default null, p_event uuid default null, p_block boolean default true)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_user is null or p_user = uid then raise exception 'INVALID_TARGET'; end if;
  if (select count(*) from public.user_reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.user_reports(reporter_id, reported_id, event_id, reason, details)
  values (uid, p_user, p_event, p_reason, nullif(left(trim(coalesce(p_details,'')), 1000), ''))
  returning id into rid;
  if p_block then perform public.block_user(p_user); end if;
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id,metadata)
  values (uid, p_event, 'user.reported', 'user_report', rid, jsonb_build_object('reason', p_reason));
  return rid;
end; $$;

-- Moderation: super admin only (suspension is platform-wide).
create or replace function public.review_report(p_report uuid, p_status text, p_note text default null, p_suspend boolean default false)
returns public.user_reports language plpgsql security definer set search_path=public as $$
declare r public.user_reports%rowtype;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('REVIEWED','ACTION_TAKEN','DISMISSED') then raise exception 'INVALID_STATUS'; end if;
  update public.user_reports
    set status = p_status, resolution_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report returning * into r;
  if not found then raise exception 'REPORT_NOT_FOUND'; end if;
  if p_suspend then
    update public.profiles set suspended_at = coalesce(suspended_at, now()) where id = r.reported_id;
  end if;
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id,metadata)
  values (auth.uid(), r.event_id, 'report.reviewed', 'user_report', r.id, jsonb_build_object('status', p_status, 'suspend', p_suspend));
  return r;
end; $$;

-- ============================================================
-- 6. Admin (PRD §11)
-- ============================================================
-- POST /admin/events/:id/close
create or replace function public.close_event(p_event uuid)
returns public.events language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not public.can_admin_venue(e.venue_id) then raise exception 'FORBIDDEN'; end if;
  update public.events set status = 'ended', ends_at = least(coalesce(ends_at, now()), now()) where id = p_event returning * into e;
  perform public._expire_event_quota(p_event);
  update public.venue_sessions set status = 'expired' where event_id = p_event and status = 'active';
  insert into public.audit_logs(actor_id,venue_id,event_id,action,entity_type,entity_id) values (auth.uid(), e.venue_id, p_event, 'event.closed', 'event', p_event);
  return e;
end; $$;

-- Sweep for events whose ends_at passed without close_event(). Schedule with pg_cron, e.g.
--   select cron.schedule('sirgaz-expire-events', '*/5 * * * *', 'select public.expire_ended_events()');
create or replace function public.expire_ended_events()
returns integer language plpgsql security definer set search_path=public as $$
declare ev uuid; n integer := 0;
begin
  for ev in select distinct w.event_id from public.event_wallets w join public.events e on e.id = w.event_id
            where w.status = 'ACTIVE' and (e.status = 'ended' or (e.ends_at is not null and e.ends_at <= now())) loop
    perform public._expire_event_quota(ev);
    n := n + 1;
  end loop;
  return n;
end; $$;

-- GET /admin/events/:id/match-analytics + reroll-analytics
create or replace function public.event_match_analytics(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v jsonb;
begin
  if not public.can_manage_event(p_event) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'participants', (select count(*) from public.event_participants where event_id = p_event),
    'participants_by_gender', (select coalesce(jsonb_object_agg(g, n), '{}'::jsonb) from (
        select coalesce(p.gender,'unknown') g, count(*) n from public.event_participants ep
        left join public.profiles p on p.id = ep.user_id where ep.event_id = p_event group by 1) x),
    'profiles_complete', (select count(*) from public.event_participants ep where ep.event_id = p_event and public._profile_complete(ep.user_id)),
    'sessions', (select count(*) from public.event_match_sessions where event_id = p_event),
    'matches_shown', (select count(*) from public.event_match_history where event_id = p_event),
    'repeat_matches_shown', (select coalesce(sum(n - 1), 0) from (
        select count(*) n from public.event_match_history where event_id = p_event group by user_id, matched_user_id) x),
    'rerolls_free', (select count(*) from public.event_match_history where event_id = p_event and match_source = 'FREE_REROLL'),
    'rerolls_paid', (select count(*) from public.event_match_history where event_id = p_event and match_source = 'PAID_REROLL'),
    'reports_open', (select count(*) from public.user_reports where event_id = p_event and status = 'OPEN')
  ) into v;
  return v;
end; $$;

-- Phase-2 hook: the Midtrans webhook (server, service_role) credits paid rerolls exactly once.
create or replace function public.credit_paid_rerolls(p_event uuid, p_user uuid, p_amount integer, p_idempotency_key text, p_reference text default null)
returns public.event_wallets language plpgsql security definer set search_path=public as $$
declare w public.event_wallets%rowtype;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  w := public._ensure_wallet(p_event, p_user);
  if exists(select 1 from public.wallet_transactions where idempotency_key = 'paid:' || p_idempotency_key) then
    return w;  -- duplicate webhook: no double credit (PY-02)
  end if;
  if w.status <> 'ACTIVE' then raise exception 'EVENT_ENDED'; end if;
  insert into public.wallet_transactions(wallet_id,event_id,user_id,kind,paid_delta,idempotency_key,reference_type,reference_id)
  values (w.id, p_event, p_user, 'PAID_GRANT', p_amount, 'paid:' || p_idempotency_key, 'payment_order', p_reference);
  update public.event_wallets set paid_rerolls_remaining = paid_rerolls_remaining + p_amount, updated_at = now()
    where id = w.id returning * into w;
  return w;
end; $$;

-- ============================================================
-- 7. Grants
-- ============================================================
do $$
declare f text;
begin
  -- internal helpers: nobody but the owner
  foreach f in array array[
    'public._safe_date(text)', 'public._user_age(uuid)', 'public._profile_complete(uuid)',
    'public._is_blocked_pair(uuid,uuid)', 'public._event_open(public.events)',
    'public._is_eligible_match(uuid,uuid,uuid)', 'public._pick_random_candidate(uuid,uuid,uuid)',
    'public._compatibility(uuid,uuid)', 'public._match_card(uuid,uuid)',
    'public._matchmaking_state(public.event_match_sessions,text)', 'public._expire_event_quota(uuid)',
    'public._matchmaking_guard(uuid)', 'public._ensure_wallet(uuid,uuid)', 'public._ensure_session(uuid)',
    'public.credit_paid_rerolls(uuid,uuid,integer,text,text)', 'public.expire_ended_events()'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists(select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    if exists(select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f); end if;
  end loop;
  if exists(select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.credit_paid_rerolls(uuid,uuid,integer,text,text) to service_role;
    grant execute on function public.expire_ended_events() to service_role;
  end if;

  -- client RPCs: signed-in users only
  foreach f in array array[
    'public.matchmaking_start(uuid)', 'public.matchmaking_current(uuid)', 'public.matchmaking_reroll(uuid,text)',
    'public.matchmaking_quota(uuid)', 'public.matchmaking_history(uuid)', 'public.matchmaking_eligibility(uuid)',
    'public.matchmaking_confirm(uuid)', 'public.block_user(uuid)', 'public.unblock_user(uuid)',
    'public.report_user(uuid,text,text,uuid,boolean)', 'public.review_report(uuid,text,text,boolean)',
    'public.close_event(uuid)', 'public.event_match_analytics(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists(select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 8. RLS — read-only, scoped; no direct client writes on new tables.
-- ============================================================
alter table public.event_match_sessions enable row level security;
alter table public.event_match_history enable row level security;
alter table public.event_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists match_sessions_read on public.event_match_sessions;
create policy match_sessions_read on public.event_match_sessions for select to authenticated
  using(user_id = (select auth.uid()) or public.can_manage_event(event_id));
drop policy if exists match_history_read on public.event_match_history;
create policy match_history_read on public.event_match_history for select to authenticated
  using(user_id = (select auth.uid()) or public.can_manage_event(event_id));
drop policy if exists wallets_read on public.event_wallets;
create policy wallets_read on public.event_wallets for select to authenticated
  using(user_id = (select auth.uid()) or public.can_manage_event(event_id));
drop policy if exists wallet_tx_read on public.wallet_transactions;
create policy wallet_tx_read on public.wallet_transactions for select to authenticated
  using(user_id = (select auth.uid()) or public.can_manage_event(event_id));
drop policy if exists blocks_self_read on public.user_blocks;
create policy blocks_self_read on public.user_blocks for select to authenticated
  using(blocker_id = (select auth.uid()));
drop policy if exists reports_read on public.user_reports;
create policy reports_read on public.user_reports for select to authenticated
  using(reporter_id = (select auth.uid()) or public.is_super_admin()
        or (event_id is not null and public.can_manage_event(event_id)));

-- The person currently shown to a user is readable by that user only (not the reverse).
drop policy if exists profiles_read_scoped on public.profiles;
create policy profiles_read_scoped on public.profiles for select to authenticated using(
  profiles.id = (select auth.uid())
  or public.is_super_admin()
  or exists(
    select 1 from public.matches m
    where (m.user_a = (select auth.uid()) and m.user_b = profiles.id)
       or (m.user_b = (select auth.uid()) and m.user_a = profiles.id)
  )
  or exists(
    select 1 from public.event_match_sessions s
    where s.user_id = (select auth.uid()) and s.current_match_user_id = profiles.id
  )
  or public.is_participant_of_my_venue(profiles.id)
);

-- Blocked users can no longer message each other.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and ((select auth.uid()) = m.user_a or (select auth.uid()) = m.user_b)
      and not public._is_blocked_pair(m.user_a, m.user_b)
  )
);
-- messages_insert runs as the caller: allow the block check helper for authenticated.
grant execute on function public._is_blocked_pair(uuid,uuid) to authenticated;

commit;
