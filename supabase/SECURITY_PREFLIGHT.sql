-- sirgaZ security preflight / adversarial checks.
-- Read-only. Run in Supabase SQL Editor before production rollout.

-- 1. Reverse duplicate matches: expected 0 rows.
select event_id,least(user_a,user_b) user_low,greatest(user_a,user_b) user_high,count(*) duplicate_count
from public.matches
group by event_id,least(user_a,user_b),greatest(user_a,user_b)
having count(*)>1;

-- 2. Self matches: expected 0.
select count(*) self_matches from public.matches where user_a=user_b;

-- 3. Orphan matches: expected 0.
select count(*) orphan_matches
from public.matches m
where not exists(select 1 from public.event_participants p where p.event_id=m.event_id and p.user_id=m.user_a)
   or not exists(select 1 from public.event_participants p where p.event_id=m.event_id and p.user_id=m.user_b);

-- 4. Orphan missions: expected 0.
select count(*) orphan_missions
from public.missions m
where not exists(select 1 from public.matches x where x.id=m.match_id);

-- 5. Orphan rewards: expected 0.
select count(*) orphan_rewards
from public.rewards r
where not exists(select 1 from public.events e where e.id=r.event_id)
   or not exists(select 1 from public.missions m where m.id=r.mission_id);

-- 6. Venue token hashes must never be raw URLs/secrets. Expected token_hash length 64.
select count(*) invalid_token_hashes
from public.venue_access_tokens
where length(token_hash)<>64;

-- 7. Active sessions must have future expiry. Expected 0.
select count(*) stale_active_sessions
from public.venue_sessions
where status='active' and expires_at<=now();

-- 8. Every venue owner should have venue_admin role. Expected 0.
select v.id,v.owner_id
from public.venues v
where v.owner_id is not null
  and not exists(select 1 from public.user_roles r where r.user_id=v.owner_id and r.role='venue_admin' and r.venue_id=v.id);

-- 9. Participant roles are global. Expected 0 missing rows for profiles.
select p.id
from public.profiles p
where not exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='participant' and r.venue_id is null);

-- 10. Inspect remaining INSERT/UPDATE/DELETE policies on business-critical tables.
select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in('matches','missions','rewards','event_participants','profiles','venue_sessions')
order by tablename,policyname;

-- 11. Inspect security-definer RPCs.
select n.nspname as schema_name,p.proname,
       p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in('check_in_to_event','find_match','create_mission_for_match','complete_mission','redeem_reward','create_venue_access_token','create_venue_for_current_user');
