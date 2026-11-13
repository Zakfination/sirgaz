-- sirgaZ 015: PRD V2 non-payment items.
--   * Poke (Alur E, §6.4): women poke men for free; notification only, never opens a chat.
--   * In-app notifications (user_notifications; production already has an untracked
--     `notifications` table from 007-010, so a new name avoids clashing with it).
--   * Event settings are auditable (§11, §13): venue admins set times; free quota, pack
--     size and prices are platform settings that only super admins may change.
--   * Moderation queue + suspend/unsuspend for super admins; reporter is notified.
--   * Account deletion (§10): anonymise immediately, queue the auth user for removal.
-- Run after 014. Idempotent.
begin;

-- ============================================================
-- 1. Tables
-- ============================================================
alter table public.profiles add column if not exists deleted_at timestamptz;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('POKE_RECEIVED','REPORT_RESOLVED','ACCOUNT_SUSPENDED','SYSTEM')),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_idx on public.user_notifications(user_id, created_at desc);

create table if not exists public.user_pokes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, sender_id, target_id),
  check (sender_id <> target_id)
);
create index if not exists user_pokes_target_idx on public.user_pokes(target_id, created_at desc);

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ============================================================
-- 2. Notifications
-- ============================================================
create or replace function public._notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns uuid language sql security definer set search_path=public as $$
  insert into public.user_notifications(user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  update public.user_notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end; $$;

-- ============================================================
-- 3. Poke
-- ============================================================
create or replace function public.send_poke(p_event uuid, p_target uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); me public.profiles%rowtype; t public.profiles%rowtype;
        pk public.user_pokes%rowtype; e public.events%rowtype;
begin
  e := public._matchmaking_guard(p_event);  -- signed in, live event, checked in, complete profile, not suspended
  select * into me from public.profiles where id = uid;
  select * into t from public.profiles where id = p_target;
  if t.id is null or t.id = uid then raise exception 'INVALID_TARGET'; end if;
  if me.gender is distinct from 'female' or t.gender is distinct from 'male' then
    raise exception 'FORBIDDEN_GENDER_ACTION';
  end if;
  if t.suspended_at is not null or t.deleted_at is not null then raise exception 'INVALID_TARGET'; end if;
  if public._is_blocked_pair(uid, p_target) then raise exception 'USER_BLOCKED'; end if;
  -- Only someone the system actually showed her at this event (no poking arbitrary ids).
  if not exists(select 1 from public.event_match_history
                where event_id = p_event and user_id = uid and matched_user_id = p_target) then
    raise exception 'INVALID_TARGET';
  end if;
  if not exists(select 1 from public.event_participants
                where event_id = p_event and user_id = p_target and coalesce(status,'waiting') <> 'left') then
    raise exception 'NOT_EVENT_PARTICIPANT';
  end if;

  select * into pk from public.user_pokes where event_id = p_event and sender_id = uid and target_id = p_target;
  if found then
    return jsonb_build_object('poke_id', pk.id, 'already_sent', true, 'created_at', pk.created_at);
  end if;
  if (select count(*) from public.user_pokes where sender_id = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.user_pokes(event_id, sender_id, target_id) values (p_event, uid, p_target)
  on conflict (event_id, sender_id, target_id) do nothing
  returning * into pk;
  if pk.id is null then  -- lost a race with a double tap
    select * into pk from public.user_pokes where event_id = p_event and sender_id = uid and target_id = p_target;
    return jsonb_build_object('poke_id', pk.id, 'already_sent', true, 'created_at', pk.created_at);
  end if;

  perform public._notify(p_target, 'POKE_RECEIVED',
    coalesce(nullif(trim(me.name), ''), 'Seseorang') || ' mencolekmu 👋',
    'Dia tertarik ngobrol denganmu di ' || coalesce(e.title, 'event ini') || '.',
    jsonb_build_object('event_id', p_event, 'poke_id', pk.id, 'sender_id', uid));
  insert into public.audit_logs(actor_id, event_id, action, entity_type, entity_id)
  values (uid, p_event, 'poke.sent', 'user_poke', pk.id);
  return jsonb_build_object('poke_id', pk.id, 'already_sent', false, 'created_at', pk.created_at);
end; $$;

-- GET /pokes/received, /pokes/sent
create or replace function public.pokes_received(p_event uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'poke_id', k.id, 'event_id', k.event_id, 'created_at', k.created_at,
           'user', jsonb_build_object('user_id', p.id, 'name', p.name, 'avatar_url', p.avatar_url,
                                      'age', public._user_age(p.id)))
         order by k.created_at desc), '[]'::jsonb)
  from public.user_pokes k join public.profiles p on p.id = k.sender_id
  where k.target_id = auth.uid() and (p_event is null or k.event_id = p_event)
    and p.deleted_at is null and not public._is_blocked_pair(k.sender_id, k.target_id);
$$;

create or replace function public.pokes_sent(p_event uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'poke_id', k.id, 'event_id', k.event_id, 'created_at', k.created_at,
           'user', jsonb_build_object('user_id', p.id, 'name', p.name, 'avatar_url', p.avatar_url))
         order by k.created_at desc), '[]'::jsonb)
  from public.user_pokes k join public.profiles p on p.id = k.target_id
  where k.sender_id = auth.uid() and (p_event is null or k.event_id = p_event);
$$;

-- Blocklist with names for the Privacy screen (blocked users' profiles are otherwise hidden).
create or replace function public.my_blocks()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'name', p.name,
                                               'avatar_url', p.avatar_url, 'blocked_at', b.created_at)
                            order by b.created_at desc), '[]'::jsonb)
  from public.user_blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid();
$$;

-- ============================================================
-- 4. Event settings: guard + audit trail
-- ============================================================
-- SECURITY INVOKER: current_user is the API role for direct client writes.
create or replace function public.guard_event_settings()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Platform defaults; only a super admin may set other values.
    new.free_rerolls := 3; new.reroll_pack_size := 10;
    new.reroll_pack_price_idr := 10000; new.chat_unlock_price_idr := 49000;
  elsif new.free_rerolls is distinct from old.free_rerolls
     or new.reroll_pack_size is distinct from old.reroll_pack_size
     or new.reroll_pack_price_idr is distinct from old.reroll_pack_price_idr
     or new.chat_unlock_price_idr is distinct from old.chat_unlock_price_idr then
    raise exception 'MONETIZATION_SETTINGS_SUPER_ADMIN_ONLY';
  end if;
  if new.ends_at is not null and new.starts_at is not null and new.ends_at <= new.starts_at then
    raise exception 'EVENT_ENDS_BEFORE_START';
  end if;
  return new;
end; $$;
drop trigger if exists guard_event_settings on public.events;
create trigger guard_event_settings before insert or update on public.events
  for each row execute function public.guard_event_settings();

create or replace function public.audit_event_settings()
returns trigger language plpgsql security definer set search_path=public as $$
declare changed jsonb := '{}'::jsonb; k text;
begin
  foreach k in array array['status','starts_at','ends_at','capacity','free_rerolls','reroll_pack_size',
                           'reroll_pack_price_idr','chat_unlock_price_idr'] loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      changed := changed || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
    end if;
  end loop;
  if changed <> '{}'::jsonb then
    insert into public.audit_logs(actor_id, venue_id, event_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), new.venue_id, new.id, 'event.settings_changed', 'event', new.id, changed);
  end if;
  return new;
end; $$;
drop trigger if exists audit_event_settings on public.events;
create trigger audit_event_settings after update on public.events
  for each row execute function public.audit_event_settings();

-- PATCH /admin/events/:id/monetization-settings (super admin)
create or replace function public.update_event_monetization(
  p_event uuid, p_free_rerolls integer default null, p_reroll_pack_size integer default null,
  p_reroll_pack_price_idr integer default null, p_chat_unlock_price_idr integer default null)
returns public.events language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  update public.events set
    free_rerolls = coalesce(p_free_rerolls, free_rerolls),
    reroll_pack_size = coalesce(p_reroll_pack_size, reroll_pack_size),
    reroll_pack_price_idr = coalesce(p_reroll_pack_price_idr, reroll_pack_price_idr),
    chat_unlock_price_idr = coalesce(p_chat_unlock_price_idr, chat_unlock_price_idr)
  where id = p_event returning * into e;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  return e;  -- audit row written by audit_event_settings; existing wallets keep their quota
end; $$;

-- ============================================================
-- 5. Moderation (super admin)
-- ============================================================
-- GET /admin/chat/reports
create or replace function public.list_reports(p_status text default 'OPEN', p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v jsonb;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status,
      'created_at', r.created_at, 'resolution_note', r.resolution_note, 'event_id', r.event_id,
      'event_title', e.title,
      'reporter', jsonb_build_object('user_id', rp.id, 'name', rp.name, 'avatar_url', rp.avatar_url),
      'reported', jsonb_build_object('user_id', rd.id, 'name', rd.name, 'avatar_url', rd.avatar_url,
                                     'suspended_at', rd.suspended_at,
                                     'reports_total', (select count(*) from public.user_reports z where z.reported_id = rd.id)))
    as x
    from public.user_reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles rd on rd.id = r.reported_id
    left join public.events e on e.id = r.event_id
    where p_status is null or r.status = p_status
    order by r.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ) s;
  return v;
end; $$;

create or replace function public.set_user_suspension(p_user uuid, p_suspended boolean, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  update public.profiles set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end
    where id = p_user;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if p_suspended then
    -- Drop them from everyone's current match; next refresh refills for free.
    update public.event_match_sessions set current_match_user_id = null, status = 'MATCHING', updated_at = now()
      where current_match_user_id = p_user;
    perform public._notify(p_user, 'ACCOUNT_SUSPENDED', 'Akunmu ditangguhkan',
      'Akunmu ditangguhkan karena laporan pengguna. Hubungi hello@sirgaz.com jika ini keliru.', '{}'::jsonb);
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_suspended then 'user.suspended' else 'user.unsuspended' end, 'user', p_user,
          jsonb_build_object('note', p_note));
end; $$;

-- Moderation decision; suspension goes through set_user_suspension; reporter is told the outcome.
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
  if p_suspend then perform public.set_user_suspension(r.reported_id, true, p_note); end if;
  perform public._notify(r.reporter_id, 'REPORT_RESOLVED', 'Laporanmu sudah ditinjau',
    case p_status when 'ACTION_TAKEN' then 'Terima kasih. Kami sudah mengambil tindakan.'
                  else 'Terima kasih sudah melapor. Laporanmu sudah kami tinjau.' end,
    jsonb_build_object('report_id', r.id));
  insert into public.audit_logs(actor_id, event_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), r.event_id, 'report.reviewed', 'user_report', r.id, jsonb_build_object('status', p_status, 'suspend', p_suspend));
  return r;
end; $$;

-- ============================================================
-- 6. Account deletion (§10)
-- ============================================================
-- Anonymises the profile now and removes the user from matching. The auth user and any
-- stored photos are removed by a service-role job that processes account_deletion_requests.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  update public.profiles set
    name = 'Akun dihapus', bio = null, avatar_url = null, interests = '{}', goal = null,
    personality = '{}'::jsonb, deleted_at = now(), suspended_at = coalesce(suspended_at, now())
  where id = uid;
  delete from public.profile_private where user_id = uid;
  update public.event_participants set status = 'left' where user_id = uid;
  update public.venue_sessions set status = 'revoked' where user_id = uid and status = 'active';
  update public.event_match_sessions set current_match_user_id = null, status = 'MATCHING', updated_at = now()
    where current_match_user_id = uid;
  update public.event_match_sessions set status = 'SESSION_CLOSED', current_match_user_id = null, updated_at = now()
    where user_id = uid;
  delete from public.user_notifications where user_id = uid;
  insert into public.account_deletion_requests(user_id) values (uid) on conflict (user_id) do nothing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id) values (uid, 'user.deletion_requested', 'user', uid);
end; $$;

-- Deleted accounts never become eligible again (gender lock etc. no longer matter).
create or replace function public.guard_deleted_profile()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('anon', 'authenticated') and old.deleted_at is not null then
    raise exception 'ACCOUNT_DELETED';
  end if;
  return new;
end; $$;
drop trigger if exists guard_deleted_profile on public.profiles;
create trigger guard_deleted_profile before update on public.profiles
  for each row execute function public.guard_deleted_profile();

-- ============================================================
-- 7. Grants
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array['public._notify(uuid,text,text,text,jsonb)'] loop
    execute format('revoke all on function %s from public', f);
    if exists(select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    if exists(select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f); end if;
  end loop;
  foreach f in array array[
    'public.mark_notifications_read(uuid[])', 'public.send_poke(uuid,uuid)',
    'public.pokes_received(uuid)', 'public.pokes_sent(uuid)', 'public.my_blocks()',
    'public.update_event_monetization(uuid,integer,integer,integer,integer)',
    'public.list_reports(text,integer)', 'public.set_user_suspension(uuid,boolean,text)',
    'public.review_report(uuid,text,text,boolean)', 'public.delete_my_account()'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists(select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 8. RLS
-- ============================================================
alter table public.user_notifications enable row level security;
alter table public.user_pokes enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists notifications_self_read on public.user_notifications;
create policy notifications_self_read on public.user_notifications for select to authenticated
  using(user_id = (select auth.uid()));
drop policy if exists pokes_party_read on public.user_pokes;
create policy pokes_party_read on public.user_pokes for select to authenticated
  using(sender_id = (select auth.uid()) or target_id = (select auth.uid()));
-- account_deletion_requests: service role only (no policies).

-- Profiles: also readable by a man who was poked, for the sender's card.
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
  or exists(
    select 1 from public.user_pokes k
    where k.target_id = (select auth.uid()) and k.sender_id = profiles.id
  )
  or public.is_participant_of_my_venue(profiles.id)
);

-- Realtime for the notification bell (RLS still applies to subscribers).
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                    and schemaname = 'public' and tablename = 'user_notifications') then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;

commit;
