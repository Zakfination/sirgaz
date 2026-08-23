-- sirgaZ production hardening migration
-- Additive, idempotent security layer for roles, venue sessions,
-- server-authoritative matchmaking, missions and rewards.

begin;

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('super_admin','venue_admin','staff','participant');
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  venue_id uuid references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role, venue_id)
);
create index if not exists user_roles_user_idx on public.user_roles(user_id);
create index if not exists user_roles_venue_idx on public.user_roles(venue_id);

create table if not exists public.venue_access_tokens (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  token_hash text not null unique,
  label text,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists venue_access_tokens_event_idx on public.venue_access_tokens(event_id);

create table if not exists public.venue_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  access_token_id uuid references public.venue_access_tokens(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  created_at timestamptz not null default now(),
  unique(user_id,event_id)
);
create index if not exists venue_sessions_event_status_idx on public.venue_sessions(event_id,status);

create table if not exists public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birthday date,
  energy integer check (energy is null or energy between 0 and 100),
  goal text,
  personality jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(mission_id,user_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- Preserve existing matching inputs without exposing them as a public profile.
insert into public.profile_private(user_id,goal,personality)
select id, goal, coalesce(personality,'{}'::jsonb)
from public.profiles
on conflict(user_id) do update set
  goal = excluded.goal,
  personality = excluded.personality,
  updated_at = now();

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role='super_admin'); $$;

create or replace function public.has_role(p_role public.app_role,p_venue uuid default null)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id=auth.uid() and role=p_role
      and (p_venue is null or venue_id=p_venue)
  );
$$;

create or replace function public.is_venue_staff(p_venue uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select public.is_super_admin() or public.has_role('venue_admin',p_venue) or public.has_role('staff',p_venue); $$;

create or replace function public.is_venue_admin(p_venue uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select public.is_super_admin() or public.has_role('venue_admin',p_venue); $$;

create or replace function public.has_active_venue_session(p_event uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.venue_sessions
    where user_id=auth.uid() and event_id=p_event and status='active' and expires_at>now()
  );
$$;

-- Venue check-in is the only normal participant entry point.
create or replace function public.check_in_to_event(p_event uuid,p_token text)
returns public.venue_sessions
language plpgsql security definer set search_path=public
as $$
declare e public.events%rowtype; a public.venue_access_tokens%rowtype; s public.venue_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into e from public.events where id=p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if e.status <> 'live' then raise exception 'EVENT_NOT_LIVE'; end if;
  select * into a from public.venue_access_tokens
  where event_id=p_event and active=true
    and token_hash=encode(digest(trim(p_token),'sha256'),'hex')
    and (expires_at is null or expires_at>now()) limit 1;
  if not found then raise exception 'INVALID_ACCESS_TOKEN'; end if;
  insert into public.venue_sessions(user_id,venue_id,event_id,access_token_id,expires_at,status)
  values(auth.uid(),e.venue_id,p_event,a.id,least(coalesce(a.expires_at,now()+interval '2 hours'),now()+interval '2 hours'),'active')
  on conflict(user_id,event_id) do update set
    access_token_id=excluded.access_token_id,last_seen_at=now(),expires_at=excluded.expires_at,status='active'
  returning * into s;
  insert into public.event_participants(event_id,user_id,joined_at,status)
  values(p_event,auth.uid(),now(),'waiting')
  on conflict(event_id,user_id) do update set
    status=case when public.event_participants.status='left' then 'waiting' else public.event_participants.status end;
  insert into public.audit_logs(actor_id,venue_id,event_id,action,entity_type,entity_id)
  values(auth.uid(),e.venue_id,p_event,'venue.check_in','venue_session',s.id);
  return s;
end;
$$;

-- Atomic matchmaking. Candidate is selected and claimed inside one transaction.
create or replace function public.find_match(p_event uuid)
returns public.matches
language plpgsql security definer set search_path=public
as $$
declare
  me public.event_participants%rowtype;
  c public.event_participants%rowtype;
  best_id uuid; best_score integer := -1; score integer;
  my_interests text[]; c_interests text[]; my_energy integer; c_energy integer;
  my_goal text; c_goal text; interest_score integer; energy_score integer; goal_score integer;
  result public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_active_venue_session(p_event) then raise exception 'VENUE_SESSION_REQUIRED'; end if;
  select * into me from public.event_participants where event_id=p_event and user_id=auth.uid() for update;
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;
  select * into result from public.matches where event_id=p_event and (user_a=auth.uid() or user_b=auth.uid()) limit 1;
  if found then return result; end if;

  select coalesce(interests,'{}'::text[]), coalesce(goal,'') into my_interests,my_goal from public.profiles where id=auth.uid();
  select coalesce(energy,50) into my_energy from public.profile_private where user_id=auth.uid();

  for c in
    select ep.* from public.event_participants ep
    where ep.event_id=p_event and ep.user_id<>auth.uid() and ep.status='waiting'
      and exists(select 1 from public.venue_sessions vs where vs.user_id=ep.user_id and vs.event_id=p_event and vs.status='active' and vs.expires_at>now())
      and not exists(select 1 from public.matches m where m.event_id=p_event and (m.user_a=ep.user_id or m.user_b=ep.user_id))
    order by ep.joined_at,ep.user_id
    for update skip locked
  loop
    select coalesce(interests,'{}'::text[]),coalesce(goal,'') into c_interests,c_goal from public.profiles where id=c.user_id;
    select coalesce(energy,50) into c_energy from public.profile_private where user_id=c.user_id;
    select least(40,count(*)::integer*10) into interest_score from unnest(my_interests) i where i=any(c_interests);
    interest_score:=coalesce(interest_score,0);
    energy_score:=greatest(0,30-abs(my_energy-c_energy)*30/100);
    goal_score:=case when my_goal<>'' and my_goal=c_goal then 30 else 0 end;
    score:=interest_score+energy_score+goal_score;
    if score>best_score then best_score:=score;best_id:=c.user_id;end if;
  end loop;

  if best_id is null then return null; end if;
  if auth.uid()<best_id then
    insert into public.matches(event_id,user_a,user_b,score,breakdown)
    values(p_event,auth.uid(),best_id,best_score,jsonb_build_object('reasons',jsonb_build_array('Shared interests','Compatible energy','Compatible goals')))
    returning * into result;
  else
    insert into public.matches(event_id,user_a,user_b,score,breakdown)
    values(p_event,best_id,auth.uid(),best_score,jsonb_build_object('reasons',jsonb_build_array('Shared interests','Compatible energy','Compatible goals')))
    returning * into result;
  end if;
  update public.event_participants set status='matched' where event_id=p_event and user_id in(auth.uid(),best_id);
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id) values(auth.uid(),p_event,'match.created','match',result.id);
  return result;
end;
$$;

create or replace function public.create_mission_for_match(p_match uuid)
returns public.missions
language plpgsql security definer set search_path=public
as $$
declare m public.matches%rowtype; x public.missions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.matches where id=p_match and (user_a=auth.uid() or user_b=auth.uid());
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  select * into x from public.missions where match_id=p_match limit 1;
  if found then return x; end if;
  insert into public.missions(match_id,title,clues,reward_xp,reward_title,status)
  values(p_match,'Find your match and complete the mission.',jsonb_build_array(
    jsonb_build_object('label','Find your match','done',false),
    jsonb_build_object('label','Introduce yourself','done',false),
    jsonb_build_object('label','Complete the challenge','done',false)
  ),200,'sirgaZ Reward','active') returning * into x;
  return x;
end;
$$;

create or replace function public.complete_mission(p_mission uuid)
returns public.rewards
language plpgsql security definer set search_path=public
as $$
declare m public.missions%rowtype; mt public.matches%rowtype; r public.rewards%rowtype; eid uuid; xp_amount integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.missions where id=p_mission for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  select * into mt from public.matches where id=m.match_id and (user_a=auth.uid() or user_b=auth.uid());
  if not found then raise exception 'NOT_A_MATCH_PARTICIPANT'; end if;
  eid:=mt.event_id;
  if not public.has_active_venue_session(eid) then raise exception 'VENUE_SESSION_REQUIRED'; end if;
  select * into r from public.rewards where mission_id=p_mission and user_id=auth.uid() order by created_at desc limit 1;
  if found then return r; end if;
  xp_amount:=greatest(0,coalesce(m.reward_xp,0));
  insert into public.mission_completions(mission_id,user_id) values(p_mission,auth.uid()) on conflict do nothing;
  update public.missions set status='complete' where id=p_mission;
  update public.profiles set xp=coalesce(xp,0)+xp_amount where id=auth.uid();
  insert into public.rewards(user_id,event_id,mission_id,title,description,xp)
  values(auth.uid(),eid,p_mission,coalesce(m.reward_title,'sirgaZ Reward'),'Reward earned from completing a sirgaZ mission.',xp_amount)
  returning * into r;
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),eid,'mission.completed','mission',p_mission,jsonb_build_object('reward_id',r.id,'xp',xp_amount));
  return r;
end;
$$;

create or replace function public.redeem_reward(p_code text)
returns public.rewards
language plpgsql security definer set search_path=public
as $$
declare r public.rewards%rowtype; venue uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select e.venue_id into venue from public.rewards rw join public.events e on e.id=rw.event_id where rw.code=trim(p_code);
  if venue is null then raise exception 'REWARD_NOT_FOUND'; end if;
  if not public.is_venue_staff(venue) then raise exception 'STAFF_PERMISSION_REQUIRED'; end if;
  update public.rewards set redeemed_at=now() where code=trim(p_code) and redeemed_at is null returning * into r;
  if not found then raise exception 'REWARD_ALREADY_REDEEMED'; end if;
  insert into public.audit_logs(actor_id,venue_id,event_id,action,entity_type,entity_id)
  values(auth.uid(),venue,r.event_id,'reward.redeemed','reward',r.id);
  return r;
end;
$$;

-- Lock down sensitive tables.
alter table public.user_roles enable row level security;
alter table public.venue_access_tokens enable row level security;
alter table public.venue_sessions enable row level security;
alter table public.profile_private enable row level security;
alter table public.mission_completions enable row level security;
alter table public.audit_logs enable row level security;

-- Remove known permissive policies from the current schema.
drop policy if exists profiles_read on public.profiles;
drop policy if exists participants_read on public.event_participants;
drop policy if exists participants_self_insert on public.event_participants;
drop policy if exists participants_self_update on public.event_participants;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists matches_delete on public.matches;
drop policy if exists missions_write on public.missions;
drop policy if exists missions_update on public.missions;
drop policy if exists missions_delete on public.missions;
drop policy if exists rewards_self_write on public.rewards;
drop policy if exists rewards_self_update on public.rewards;
drop policy if exists rewards_self_delete on public.rewards;

create policy profiles_self_or_match_read on public.profiles for select using (
  id=auth.uid() or public.is_super_admin() or exists(
    select 1 from public.matches m where (m.user_a=auth.uid() and m.user_b=id) or (m.user_b=auth.uid() and m.user_a=id)
  )
);

create policy participants_self_or_staff_read on public.event_participants for select using (
  user_id=auth.uid() or public.is_super_admin() or exists(select 1 from public.events e where e.id=event_id and public.is_venue_staff(e.venue_id))
);

create policy participants_self_update on public.event_participants for update using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy matches_participant_read on public.matches for select using(
  user_a=auth.uid() or user_b=auth.uid() or public.is_super_admin() or exists(select 1 from public.events e where e.id=event_id and public.is_venue_staff(e.venue_id))
);

create policy missions_match_read on public.missions for select using(exists(
  select 1 from public.matches m where m.id=match_id and (m.user_a=auth.uid() or m.user_b=auth.uid() or public.is_super_admin() or exists(select 1 from public.events e where e.id=m.event_id and public.is_venue_staff(e.venue_id)))
));

create policy rewards_owner_or_staff_read on public.rewards for select using(
  user_id=auth.uid() or public.is_super_admin() or exists(select 1 from public.events e where e.id=event_id and public.is_venue_staff(e.venue_id))
);

create policy user_roles_self_read on public.user_roles for select using(user_id=auth.uid() or public.is_super_admin());
create policy venue_tokens_admin on public.venue_access_tokens for all using(public.is_super_admin() or public.is_venue_admin(venue_id)) with check(public.is_super_admin() or public.is_venue_admin(venue_id));
create policy sessions_self_or_staff on public.venue_sessions for select using(user_id=auth.uid() or public.is_super_admin() or public.is_venue_staff(venue_id));
create policy private_profile_self on public.profile_private for select using(user_id=auth.uid());
create policy private_profile_self_insert on public.profile_private for insert with check(user_id=auth.uid());
create policy private_profile_self_update on public.profile_private for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy mission_completion_self_read on public.mission_completions for select using(user_id=auth.uid() or public.is_super_admin());
create policy audit_admin_read on public.audit_logs for select using(public.is_super_admin() or (venue_id is not null and public.is_venue_staff(venue_id)));

revoke all on function public.check_in_to_event(uuid,text) from public;
grant execute on function public.check_in_to_event(uuid,text) to authenticated;
revoke all on function public.find_match(uuid) from public;
grant execute on function public.find_match(uuid) to authenticated;
revoke all on function public.create_mission_for_match(uuid) from public;
grant execute on function public.create_mission_for_match(uuid) to authenticated;
revoke all on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;
revoke all on function public.redeem_reward(text) from public;
grant execute on function public.redeem_reward(text) to authenticated;

-- Defense against reverse-pair duplicates, only if no duplicates exist.
do $$ begin
  if not exists (
    select 1 from public.matches m1 join public.matches m2
      on m1.id<>m2.id and m1.event_id=m2.event_id
      and least(m1.user_a,m1.user_b)=least(m2.user_a,m2.user_b)
      and greatest(m1.user_a,m1.user_b)=greatest(m2.user_a,m2.user_b)
  ) then
    create unique index if not exists matches_event_pair_unique
      on public.matches(event_id,least(user_a,user_b),greatest(user_a,user_b));
  end if;
end $$;

commit;
