-- Serialize match creation per event and atomically claim both users.
-- The service-role server route calls this after selecting a candidate.

create or replace function public.create_match_atomic(
  p_event_id uuid,
  p_user_id uuid,
  p_candidate_id uuid,
  p_score integer,
  p_breakdown jsonb
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_me public.event_participants;
  v_candidate public.event_participants;
begin
  if p_user_id = p_candidate_id then
    raise exception 'cannot match user with self' using errcode = '22023';
  end if;

  -- One event-wide transaction lock prevents two concurrent requests
  -- from claiming the same waiting participant.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  select * into v_me
  from public.event_participants
  where event_id = p_event_id and user_id = p_user_id
  for update;

  select * into v_candidate
  from public.event_participants
  where event_id = p_event_id and user_id = p_candidate_id
  for update;

  if v_me.user_id is null or v_candidate.user_id is null then
    raise exception 'both users must be event participants' using errcode = '42501';
  end if;

  if v_me.status <> 'waiting' or v_candidate.status <> 'waiting' then
    raise exception 'one or both users are no longer waiting' using errcode = '40001';
  end if;

  insert into public.matches (event_id, user_a, user_b, score, breakdown)
  values (p_event_id, p_user_id, p_candidate_id, p_score, p_breakdown)
  returning * into v_match;

  update public.event_participants
  set status = 'matched'
  where event_id = p_event_id
    and user_id in (p_user_id, p_candidate_id);

  return v_match;
end;
$$;

revoke all on function public.create_match_atomic(uuid, uuid, uuid, integer, jsonb) from public;
revoke all on function public.create_match_atomic(uuid, uuid, uuid, integer, jsonb) from anon;
revoke all on function public.create_match_atomic(uuid, uuid, uuid, integer, jsonb) from authenticated;
grant execute on function public.create_match_atomic(uuid, uuid, uuid, integer, jsonb) to service_role;
