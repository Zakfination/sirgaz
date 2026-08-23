-- sirgaZ production hardening follow-up
begin;

do $$ begin
  if exists (select 1 from pg_constraint where conname='user_roles_pkey') then
    alter table public.user_roles drop constraint user_roles_pkey;
  end if;
exception when undefined_table then null; end $$;

alter table public.user_roles add column if not exists id uuid default gen_random_uuid();
update public.user_roles set id=gen_random_uuid() where id is null;
alter table public.user_roles alter column id set not null;
DO $$ begin
  if not exists (select 1 from pg_constraint where conname='user_roles_pkey_v2') then
    alter table public.user_roles add constraint user_roles_pkey_v2 primary key(id);
  end if;
end $$;
create unique index if not exists user_roles_assignment_unique on public.user_roles(user_id,role,coalesce(venue_id,'00000000-0000-0000-0000-000000000000'::uuid));

insert into public.user_roles(user_id,role,venue_id)
select p.id,'participant'::public.app_role,null from public.profiles p on conflict do nothing;
insert into public.user_roles(user_id,role,venue_id)
select v.owner_id,'venue_admin'::public.app_role,v.id from public.venues v where v.owner_id is not null on conflict do nothing;

create or replace function public.ensure_participant_role()
returns void language plpgsql security definer set search_path=public
as $$ begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.user_roles(user_id,role,venue_id) values(auth.uid(),'participant',null) on conflict do nothing;
end; $$;
revoke all on function public.ensure_participant_role() from public;
grant execute on function public.ensure_participant_role() to authenticated;

create or replace function public.create_venue_access_token(p_event uuid,p_label text default 'Venue QR',p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path=public
as $$
declare e public.events%rowtype; raw text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into e from public.events where id=p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not public.is_venue_admin(e.venue_id) then raise exception 'VENUE_ADMIN_REQUIRED'; end if;
  raw:=encode(gen_random_bytes(24),'base64url');
  insert into public.venue_access_tokens(venue_id,event_id,token_hash,label,expires_at,created_by)
  values(e.venue_id,p_event,encode(digest(raw,'sha256'),'hex'),coalesce(p_label,'Venue QR'),p_expires_at,auth.uid());
  insert into public.audit_logs(actor_id,venue_id,event_id,action,entity_type)
  values(auth.uid(),e.venue_id,p_event,'venue.access_token_created','venue_access_token');
  return raw;
end; $$;
revoke all on function public.create_venue_access_token(uuid,text,timestamptz) from public;
grant execute on function public.create_venue_access_token(uuid,text,timestamptz) to authenticated;

drop policy if exists events_read on public.events;
drop policy if exists events_owner_all on public.events;
drop policy if exists events_public_read on public.events;
drop policy if exists events_admin_all on public.events;
create policy events_public_or_staff_read on public.events for select using(status in ('published','live') or public.is_super_admin() or public.is_venue_staff(venue_id));
create policy events_admin_write on public.events for all using(public.is_super_admin() or public.is_venue_admin(venue_id)) with check(public.is_super_admin() or public.is_venue_admin(venue_id));

drop policy if exists venues_read on public.venues;
drop policy if exists venues_owner_insert on public.venues;
drop policy if exists venues_owner_update on public.venues;
drop policy if exists venues_owner_delete on public.venues;
create policy venues_public_read on public.venues for select using(is_active=true or public.is_super_admin() or public.is_venue_staff(id));
create policy venues_admin_write on public.venues for all using(public.is_super_admin() or public.is_venue_admin(id)) with check(public.is_super_admin() or public.is_venue_admin(id));

DO $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='matches' and cmd in ('INSERT','UPDATE','DELETE') loop
    execute format('drop policy if exists %I on public.matches',p.policyname);
  end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='rewards' and cmd in ('INSERT','UPDATE','DELETE') loop
    execute format('drop policy if exists %I on public.rewards',p.policyname);
  end loop;
end $$;

create or replace function public.guard_profile_server_fields()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  if tg_op='UPDATE' and new.xp is distinct from old.xp then
    if current_setting('request.jwt.claim.role',true) <> 'service_role' and current_setting('app.sirgaz_trusted_write',true) <> '1' then
      raise exception 'XP_SERVER_CONTROLLED';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_profile_server_fields on public.profiles;
create trigger guard_profile_server_fields before update on public.profiles for each row execute function public.guard_profile_server_fields();

create or replace function public.complete_mission(p_mission uuid)
returns public.rewards language plpgsql security definer set search_path=public
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
  perform set_config('app.sirgaz_trusted_write','1',true);
  update public.profiles set xp=coalesce(xp,0)+xp_amount where id=auth.uid();
  insert into public.rewards(user_id,event_id,mission_id,title,description,xp)
  values(auth.uid(),eid,p_mission,coalesce(m.reward_title,'sirgaZ Reward'),'Reward earned from completing a sirgaZ mission.',xp_amount)
  returning * into r;
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),eid,'mission.completed','mission',p_mission,jsonb_build_object('reward_id',r.id,'xp',xp_amount));
  return r;
end; $$;
revoke all on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;

commit;
