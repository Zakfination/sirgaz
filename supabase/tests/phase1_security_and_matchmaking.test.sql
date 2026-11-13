-- sirgaZ automated checks for 012 (security) + 013 (PRD V2 phase 1).
-- Runs inside one transaction and ROLLS BACK: safe for a local or staging database.
-- DO NOT run against production.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_security_and_matchmaking.test.sql
-- Every check prints "PASS <id>"; the first failure aborts with "FAIL <id>".
\set QUIET on
begin;

create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL %', label; end if;
  raise notice 'PASS %', label;
end; $$;

create function pg_temp.expect_error(stmt text, code text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL % (no error, expected %)', label, code;
exception when others then
  if sqlerrm like 'FAIL %' then raise; end if;
  if position(code in sqlerrm) = 0 then raise exception 'FAIL % (got "%", expected %)', label, sqlerrm, code; end if;
  raise notice 'PASS %', label;
end; $$;

create function pg_temp.act(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
end; $$;

grant execute on all functions in schema pg_temp to public;

-- Fixed ids --------------------------------------------------------------
-- A venue admin, X attacker, M1/M2 men, W1/W2 women seeking men, W3 woman seeking women,
-- I incomplete profile, O not checked in.
create temp table ids(k text primary key, v uuid);
insert into ids values
 ('A','a0000000-0000-0000-0000-000000000001'),('X','a0000000-0000-0000-0000-000000000002'),
 ('M1','a0000000-0000-0000-0000-000000000011'),('M2','a0000000-0000-0000-0000-000000000012'),
 ('W1','a0000000-0000-0000-0000-000000000021'),('W2','a0000000-0000-0000-0000-000000000022'),
 ('W3','a0000000-0000-0000-0000-000000000023'),('I','a0000000-0000-0000-0000-000000000031'),
 ('O','a0000000-0000-0000-0000-000000000041'),
 ('V','b0000000-0000-0000-0000-000000000001'),('E','c0000000-0000-0000-0000-000000000001'),
 ('E0','c0000000-0000-0000-0000-000000000000'),('E2','c0000000-0000-0000-0000-000000000002');
grant select on ids to public;
create function pg_temp.id(k text) returns uuid language sql stable as $$ select v from ids where ids.k = id.k $$;
grant execute on all functions in schema pg_temp to public;

insert into auth.users(id) select v from ids where k not in ('V','E','E0','E2');
insert into public.venues(id, owner_id, name) values (pg_temp.id('V'), pg_temp.id('A'), 'Test Venue');
insert into public.user_roles(user_id, role, venue_id) values (pg_temp.id('A'), 'venue_admin', pg_temp.id('V'));
insert into public.events(id, venue_id, title, status, ends_at) values
  (pg_temp.id('E'),  pg_temp.id('V'), 'Live night', 'live',  now() + interval '6 hours'),
  (pg_temp.id('E0'), pg_temp.id('V'), 'Past night', 'ended', now() - interval '1 day'),
  (pg_temp.id('E2'), pg_temp.id('V'), 'Next night', 'live',  now() + interval '6 hours');
insert into public.event_participants(event_id, user_id) values (pg_temp.id('E0'), pg_temp.id('W1')), (pg_temp.id('E0'), pg_temp.id('M1'));
insert into public.matches(event_id, user_a, user_b) values (pg_temp.id('E0'), pg_temp.id('M1'), pg_temp.id('W1'));

-- Venue admin issues the QR secret --------------------------------------
set local role authenticated;
select pg_temp.act(pg_temp.id('A'));
create temp table qr as select public.create_venue_access_token(pg_temp.id('E'), 'QR', null) t,
                                public.create_venue_access_token(pg_temp.id('E2'), 'QR2', null) t2;
reset role;
grant select on qr to public;

-- Every user writes their own profile through the API role, then checks in.
create function pg_temp.onboard(k text, g text, seek text, complete boolean, checkin boolean) returns void language plpgsql as $$
begin
  perform pg_temp.act(pg_temp.id(k));
  insert into public.profiles(id, name, gender, avatar_url, interests, goal, personality, xp)
  values (pg_temp.id(k), k, g, 'https://example.test/' || k || '.jpg',
          case when complete then array['Music','Techno'] else '{}'::text[] end, 'friends',
          jsonb_build_object('birthday', '1998-05-01'), 999999)
  on conflict (id) do update set name = excluded.name;
  insert into public.profile_private(user_id, seeking, energy, birthday) values (pg_temp.id(k), seek, 60, '1998-05-01')
  on conflict (user_id) do update set seeking = excluded.seeking;
  if checkin then
    perform public.check_in_to_event(pg_temp.id('E'), (select t from qr));
  end if;
end; $$;
grant execute on all functions in schema pg_temp to public;

set local role authenticated;
select pg_temp.onboard('M1','male','female',true,true);
select pg_temp.onboard('M2','male','female',true,true);
select pg_temp.onboard('W1','female','male',true,true);
select pg_temp.onboard('W2','female','male',true,true);
select pg_temp.onboard('W3','female','female',true,true);
select pg_temp.onboard('I','female','male',false,true);
select pg_temp.onboard('O','female','male',true,false);
select pg_temp.onboard('X','male','any',true,false);

-- ===================== SECURITY REGRESSIONS (012) ========================
select pg_temp.act(pg_temp.id('X'));
select pg_temp.ok((select count(*) from public.profiles) = 1, 'SEC-01 stranger sees only own profile');
select pg_temp.ok((select xp from public.profiles where id = pg_temp.id('X')) = 0, 'SEC-02 client-supplied XP on insert is forced to 0');
select pg_temp.expect_error($$update public.profiles set xp = 5000000 where id = auth.uid()$$, 'XP_SERVER_CONTROLLED', 'SEC-03 client cannot raise own XP');
select pg_temp.expect_error($$update public.profiles set suspended_at = now() where id = auth.uid()$$, 'SUSPENSION_SERVER_CONTROLLED', 'SEC-04 client cannot touch suspended_at');
select public.create_venue_for_current_user('Evil Club');
select pg_temp.ok((select count(*) from public.event_participants where event_id = pg_temp.id('E0')) = 0, 'SEC-05 other venue admin cannot read participants of an ended event');
select pg_temp.ok((select count(*) from public.matches) = 0, 'SEC-06 other venue admin cannot read matches of another venue');

select pg_temp.act(pg_temp.id('M1'));
with u as (update public.event_participants set joined_at = '2000-01-01' where user_id = auth.uid() returning 1)
select pg_temp.ok((select count(*) from u) = 0, 'SEC-07 participant cannot rewrite own participation row');
select pg_temp.ok(public.count_event_participants(pg_temp.id('E')) = 6, 'SEC-08 count_event_participants exists and counts');
select pg_temp.expect_error($$update public.profiles set gender = 'female' where id = auth.uid()$$, 'GENDER_LOCKED', 'SEC-09 gender cannot be changed once set');

select pg_temp.act(pg_temp.id('A'));
select pg_temp.ok((select count(*) from public.event_participants where event_id = pg_temp.id('E0')) = 2, 'SEC-10 owning venue admin still sees own participants');

-- ===================== MATCHMAKING (PRD §9) ==============================
select pg_temp.act(pg_temp.id('M1'));
create temp table s1 as select public.matchmaking_start(pg_temp.id('E')) j;
grant select on s1 to public;
select pg_temp.ok((select (j->'match'->>'user_id')::uuid in (pg_temp.id('W1'), pg_temp.id('W2')) from s1), 'MM-01 first match created automatically and eligible');
select pg_temp.ok((select (j->'quota'->>'free_remaining')::int = 3 from s1), 'RR-01 new event session gets 3 free rerolls');
select pg_temp.ok((select public.matchmaking_start(pg_temp.id('E'))->'match'->>'user_id' = j->'match'->>'user_id' from s1), 'MM-02 reload keeps the same match');
select pg_temp.ok((select public.matchmaking_current(pg_temp.id('E'))->>'match_count' = '1'), 'MM-02b reload does not create a new match');
select pg_temp.ok((select count(*) from public.event_match_sessions where user_id = auth.uid() and event_id = pg_temp.id('E')) = 1, 'MM-03 session not duplicated');
select pg_temp.ok(((public.matchmaking_start(pg_temp.id('E'))->'match') ? 'personality') and not ((public.matchmaking_start(pg_temp.id('E'))->'match'->'personality') ? 'birthday'), 'PRIV-01 match card hides birthday');
select pg_temp.ok((select count(*) from public.profiles where id = (select (j->'match'->>'user_id')::uuid from s1)) = 1, 'PRIV-02 viewer can read the profile currently shown');

select pg_temp.act(pg_temp.id('M2'));
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'))->'quota'->>'free_remaining')::int = 2, 'RR-02 first reroll uses one free quota');
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'), 'retry-key')->'quota'->>'free_remaining')::int = 1, 'RR-02b reroll with idempotency key');
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'), 'retry-key')->'quota'->>'free_remaining')::int = 1, 'RR-11 retried request does not spend twice');
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'))->>'used_source') = 'FREE', 'RR-03a third reroll is FREE');
select pg_temp.ok((public.matchmaking_quota(pg_temp.id('E'))->>'free_remaining')::int = 0, 'RR-03 free quota reaches zero');
select pg_temp.expect_error($$select public.matchmaking_reroll(pg_temp.id('E'))$$, 'REROLL_QUOTA_EXHAUSTED', 'RR-04 exhausted quota is rejected (purchase offered)');
select pg_temp.expect_error($$select public.credit_paid_rerolls(pg_temp.id('E'), auth.uid(), 10, 'fake', null)$$, 'permission denied', 'PY-SEC client cannot credit paid rerolls');

reset role;
select public.credit_paid_rerolls(pg_temp.id('E'), pg_temp.id('M2'), 10, 'order-001', 'order-001');
select public.credit_paid_rerolls(pg_temp.id('E'), pg_temp.id('M2'), 10, 'order-001', 'order-001');
select public.credit_paid_rerolls(pg_temp.id('E'), pg_temp.id('W1'), 10, 'order-002', 'order-002');
set local role authenticated;
select pg_temp.act(pg_temp.id('M2'));
select pg_temp.ok((public.matchmaking_quota(pg_temp.id('E'))->>'paid_remaining')::int = 10, 'RR-05/PY-02 paid pack adds 10 once despite duplicate webhook');
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'))->>'used_source') = 'PAID', 'RR-07 man spends paid reroll after free');
select pg_temp.act(pg_temp.id('W1'));
select pg_temp.ok((public.matchmaking_reroll(pg_temp.id('E'))->>'used_source') = 'FREE', 'RR-06a woman uses free first');

-- 30 paid rerolls for M2: only W1/W2 ever shown, both recur, never the same twice in a row.
select pg_temp.act(pg_temp.id('M2'));
reset role;
select public.credit_paid_rerolls(pg_temp.id('E'), pg_temp.id('M2'), 30, 'order-003', 'order-003');
set local role authenticated;
select pg_temp.act(pg_temp.id('M2'));
do $$ declare i int; begin for i in 1..29 loop perform public.matchmaking_reroll(pg_temp.id('E')); end loop; end $$;
select pg_temp.ok((select bool_and(matched_user_id in (pg_temp.id('W1'), pg_temp.id('W2'))) from public.event_match_history where user_id = auth.uid()), 'MM-04 ineligible candidates (wrong preference / incomplete / not checked in / self) never shown');
select pg_temp.ok((select count(distinct matched_user_id) = 2 and count(*) > 2 from public.event_match_history where user_id = auth.uid()), 'MM-05/RR-08 same person may appear again');
select pg_temp.ok(not exists(select 1 from (select matched_user_id, lag(matched_user_id) over (order by match_number) prev from public.event_match_history where user_id = auth.uid()) x where matched_user_id = prev), 'RR-12 reroll never returns the person already shown');

-- Block: M1 blocks his current match; she is never shown again and the replacement is free.
select pg_temp.act(pg_temp.id('M1'));
create temp table blk as select (public.matchmaking_current(pg_temp.id('E'))->'match'->>'user_id')::uuid b;
grant select on blk to public;
select public.block_user((select b from blk));
select pg_temp.ok((select (public.matchmaking_current(pg_temp.id('E'))->'match'->>'user_id')::uuid <> b from blk), 'MM-06 blocked user removed from current match');
select pg_temp.ok((public.matchmaking_quota(pg_temp.id('E'))->>'free_remaining')::int = 3, 'MM-06b replacement after block is free');
select pg_temp.expect_error($$select public.matchmaking_reroll(pg_temp.id('E'))$$, 'NO_CANDIDATE_AVAILABLE', 'MM-06c with blocked user excluded nobody else is available (no charge)');
select pg_temp.ok((public.matchmaking_quota(pg_temp.id('E'))->>'free_remaining')::int = 3, 'MM-06d failed reroll did not consume quota');

-- Messages blocked between blocked pair (existing chat path).
reset role;
insert into public.matches(event_id, user_a, user_b) select pg_temp.id('E'), least(pg_temp.id('M1'), b), greatest(pg_temp.id('M1'), b) from blk;
set local role authenticated;
select pg_temp.act(pg_temp.id('M1'));
select pg_temp.expect_error($$insert into public.messages(match_id, sender_id, content) select id, auth.uid(), 'hi' from public.matches where event_id = pg_temp.id('E') and (user_a = auth.uid() or user_b = auth.uid()) limit 1$$, 'row-level security', 'CH-11 blocked pair cannot message');

select pg_temp.act(pg_temp.id('O'));
select pg_temp.expect_error($$select public.matchmaking_start(pg_temp.id('E'))$$, 'NOT_EVENT_PARTICIPANT', 'MM-07 non-participant rejected');
select pg_temp.act(pg_temp.id('I'));
select pg_temp.expect_error($$select public.matchmaking_start(pg_temp.id('E'))$$, 'PROFILE_INCOMPLETE', 'MM-08 incomplete profile rejected');
select pg_temp.ok((public.matchmaking_eligibility(pg_temp.id('E'))->>'eligible')::boolean = false, 'MM-09 eligibility endpoint explains');

-- Reports
select pg_temp.act(pg_temp.id('W2'));
select pg_temp.ok(public.report_user(pg_temp.id('M2'), 'harassment', 'test', pg_temp.id('E'), true) is not null, 'SAFE-01 report created');
select pg_temp.ok(exists(select 1 from public.user_blocks where blocker_id = auth.uid() and blocked_id = pg_temp.id('M2')), 'SAFE-02 report also blocks');
select pg_temp.expect_error($$select public.review_report((select id from public.user_reports limit 1), 'DISMISSED')$$, 'FORBIDDEN', 'SAFE-03 only super admin moderates');
select pg_temp.expect_error($q$do $d$ begin for i in 1..10 loop perform public.report_user(pg_temp.id('M1'), 'spam', null, null, false); end loop; end $d$$q$, 'RATE_LIMITED', 'SAFE-04 report rate limit');

-- Analytics & admin
select pg_temp.act(pg_temp.id('X'));
select pg_temp.expect_error($$select public.event_match_analytics(pg_temp.id('E'))$$, 'FORBIDDEN', 'ADM-01 analytics forbidden for other venues');
select pg_temp.expect_error($$select public.close_event(pg_temp.id('E'))$$, 'FORBIDDEN', 'ADM-02 close forbidden for other venues');
select pg_temp.act(pg_temp.id('A'));
select pg_temp.ok((public.event_match_analytics(pg_temp.id('E'))->>'rerolls_paid')::int >= 30, 'ADM-03 analytics counts paid rerolls');

-- Ledger must match balances before and after expiry.
create function pg_temp.ledger_consistent() returns boolean language sql as $$
  select bool_and(w.free_rerolls_total - w.free_rerolls_used = coalesce(t.f,0) and w.paid_rerolls_remaining = coalesce(t.p,0))
  from public.event_wallets w
  left join (select wallet_id, sum(free_delta) f, sum(paid_delta) p from public.wallet_transactions group by wallet_id) t on t.wallet_id = w.id;
$$;
grant execute on all functions in schema pg_temp to public;
reset role;
select pg_temp.ok(pg_temp.ledger_consistent(), 'PY-06 wallet balances equal ledger');

set local role authenticated;
select pg_temp.act(pg_temp.id('A'));
select public.close_event(pg_temp.id('E'));
select pg_temp.act(pg_temp.id('M2'));
select pg_temp.expect_error($$select public.matchmaking_reroll(pg_temp.id('E'))$$, 'EVENT_ENDED', 'RR-09 quota unusable after event ends');
select pg_temp.ok(public.matchmaking_quota(pg_temp.id('E'))->>'status' = 'EXPIRED' and (public.matchmaking_quota(pg_temp.id('E'))->>'paid_remaining')::int = 0, 'RR-09b remaining quota expired');
reset role;
select pg_temp.ok(pg_temp.ledger_consistent(), 'PY-06b ledger still consistent after expiry');

-- New event: fresh 3 free.
set local role authenticated;
select pg_temp.act(pg_temp.id('M1'));
select public.check_in_to_event(pg_temp.id('E2'), (select t2 from qr));
select pg_temp.act(pg_temp.id('W1'));
select public.check_in_to_event(pg_temp.id('E2'), (select t2 from qr));
select pg_temp.act(pg_temp.id('M1'));
select pg_temp.ok((public.matchmaking_start(pg_temp.id('E2'))->'quota'->>'free_remaining')::int = 3, 'RR-10 new event grants 3 new free rerolls');

\echo 'ALL CHECKS PASSED'
rollback;
