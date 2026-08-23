-- Serialize matchmaking per event to guarantee one pairing decision at a time.
begin;
create or replace function public.find_match(p_event uuid)
returns public.matches language plpgsql security definer set search_path=public
as $$
declare me public.event_participants%rowtype; c public.event_participants%rowtype; best_id uuid; best_score integer:=-1; score integer; my_interests text[]; c_interests text[]; my_energy integer; c_energy integer; my_goal text; c_goal text; interest_score integer; energy_score integer; goal_score integer; result public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_active_venue_session(p_event) then raise exception 'VENUE_SESSION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sirgaz:match:'||p_event::text,0));
  select * into me from public.event_participants where event_id=p_event and user_id=auth.uid() for update;
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;
  select * into result from public.matches where event_id=p_event and (user_a=auth.uid() or user_b=auth.uid()) limit 1;
  if found then return result; end if;
  select coalesce(interests,'{}'::text[]),coalesce(goal,'') into my_interests,my_goal from public.profiles where id=auth.uid();
  select coalesce(energy,50) into my_energy from public.profile_private where user_id=auth.uid();
  for c in select ep.* from public.event_participants ep where ep.event_id=p_event and ep.user_id<>auth.uid() and ep.status='waiting' and exists(select 1 from public.venue_sessions vs where vs.user_id=ep.user_id and vs.event_id=p_event and vs.status='active' and vs.expires_at>now()) and not exists(select 1 from public.matches m where m.event_id=p_event and (m.user_a=ep.user_id or m.user_b=ep.user_id)) order by ep.joined_at,ep.user_id for update loop
    select coalesce(interests,'{}'::text[]),coalesce(goal,'') into c_interests,c_goal from public.profiles where id=c.user_id;
    select coalesce(energy,50) into c_energy from public.profile_private where user_id=c.user_id;
    select least(40,count(*)::integer*10) into interest_score from unnest(my_interests) i where i=any(c_interests); interest_score:=coalesce(interest_score,0);
    energy_score:=greatest(0,30-abs(my_energy-c_energy)*30/100); goal_score:=case when my_goal<>'' and my_goal=c_goal then 30 else 0 end; score:=interest_score+energy_score+goal_score;
    if score>best_score then best_score:=score;best_id:=c.user_id;end if;
  end loop;
  if best_id is null then return null; end if;
  if auth.uid()<best_id then insert into public.matches(event_id,user_a,user_b,score,breakdown) values(p_event,auth.uid(),best_id,best_score,jsonb_build_object('reasons',jsonb_build_array('Shared interests','Compatible energy','Compatible goals'))) returning * into result;
  else insert into public.matches(event_id,user_a,user_b,score,breakdown) values(p_event,best_id,auth.uid(),best_score,jsonb_build_object('reasons',jsonb_build_array('Shared interests','Compatible energy','Compatible goals'))) returning * into result; end if;
  update public.event_participants set status='matched' where event_id=p_event and user_id in(auth.uid(),best_id);
  insert into public.audit_logs(actor_id,event_id,action,entity_type,entity_id) values(auth.uid(),p_event,'match.created','match',result.id);
  return result;
end; $$;
revoke all on function public.find_match(uuid) from public;
grant execute on function public.find_match(uuid) to authenticated;
commit;
