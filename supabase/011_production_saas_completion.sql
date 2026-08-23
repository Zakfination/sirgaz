-- sirgaZ production SaaS completion
-- Safe additive migration. Run after 010_lockdown_remaining_public_policies.
begin;

-- ============================================================
-- 1. MULTI-TENANT / MARKET EXCLUSIVITY
-- ============================================================
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null default 'ID',
  timezone text not null default 'Asia/Jakarta',
  exclusive_venue_id uuid references public.venues(id) on delete set null,
  exclusive_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists markets_exclusive_venue_unique
  on public.markets(exclusive_venue_id) where exclusive_venue_id is not null;

create table if not exists public.venue_subscriptions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  market_id uuid references public.markets(id) on delete restrict,
  plan text not null default 'founding',
  status text not null default 'trial' check(status in ('trial','active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  external_customer_id text,
  external_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists venue_subscriptions_venue_idx on public.venue_subscriptions(venue_id,status);
create index if not exists venue_subscriptions_market_idx on public.venue_subscriptions(market_id,status);
create unique index if not exists venue_subscriptions_active_venue_unique
  on public.venue_subscriptions(venue_id) where status in ('trial','active','past_due');
create unique index if not exists venue_subscriptions_active_market_unique
  on public.venue_subscriptions(market_id) where market_id is not null and status in ('trial','active','past_due');

-- Enforce one active market -> one venue at the database layer.
create or replace function public.validate_market_exclusivity()
returns trigger language plpgsql security definer set search_path=public as $$
declare m public.markets%rowtype;
begin
  if new.market_id is null or new.status not in ('trial','active','past_due') then return new; end if;
  select * into m from public.markets where id=new.market_id for update;
  if not found or not m.active then raise exception 'MARKET_NOT_FOUND_OR_INACTIVE'; end if;
  if m.exclusive_venue_id is not null and m.exclusive_venue_id <> new.venue_id and coalesce(m.exclusive_until, now()) > now() then
    raise exception 'MARKET_ALREADY_EXCLUSIVE';
  end if;
  update public.markets
    set exclusive_venue_id=new.venue_id,
        exclusive_until=greatest(coalesce(m.exclusive_until,now()),coalesce(new.ends_at,now()+interval '1 year')),
        updated_at=now()
    where id=new.market_id;
  return new;
end; $$;
drop trigger if exists validate_market_exclusivity on public.venue_subscriptions;
create trigger validate_market_exclusivity before insert or update of market_id,status,ends_at on public.venue_subscriptions
for each row execute function public.validate_market_exclusivity();

-- ============================================================
-- 2. WHITE LABEL / VENUE CONFIGURATION
-- ============================================================
create table if not exists public.venue_branding (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  logo_url text,
  favicon_url text,
  primary_color text not null default '#FF2D8D',
  secondary_color text not null default '#7C3AED',
  background_color text not null default '#070707',
  surface_color text not null default '#111111',
  accent_color text,
  font_family text default 'Inter',
  loading_logo_url text,
  loading_text text default 'Powered by sirgaZ',
  footer_text text default 'Powered by sirgaZ',
  hide_powered_by boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.venue_domains (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  hostname text not null unique,
  type text not null default 'subdomain' check(type in ('subdomain','custom')),
  verified boolean not null default false,
  verification_token text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists venue_domains_venue_idx on public.venue_domains(venue_id);

create table if not exists public.venue_feature_flags (
  venue_id uuid not null references public.venues(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(venue_id,feature_key)
);

-- ============================================================
-- 3. EVENT MISSION / REWARD CATALOG
-- ============================================================
create table if not exists public.event_mission_templates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  description text,
  clues jsonb not null default '[]'::jsonb,
  reward_xp integer not null default 100,
  reward_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_mission_templates_venue_idx on public.event_mission_templates(venue_id,active);

create table if not exists public.venue_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  points_cost integer not null default 0 check(points_cost >= 0),
  stock integer check(stock is null or stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists venue_reward_catalog_venue_idx on public.venue_reward_catalog(venue_id,active);

-- ============================================================
-- 4. AUDIT / OPERATIONS
-- ============================================================
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,external_id)
);
create index if not exists webhook_events_unprocessed_idx on public.webhook_events(created_at) where processed_at is null;

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. SECURITY DEFINER HELPERS
-- ============================================================
create or replace function public.can_manage_venue(p_venue uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_super_admin() or public.has_role('venue_admin',p_venue) or public.has_role('staff',p_venue);
$$;

create or replace function public.can_admin_venue(p_venue uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_super_admin() or public.has_role('venue_admin',p_venue);
$$;

-- Server-side venue configuration write. Avoid direct client writes to sensitive fields.
create or replace function public.upsert_venue_branding(
  p_venue uuid,
  p_logo_url text default null,
  p_primary_color text default '#FF2D8D',
  p_secondary_color text default '#7C3AED',
  p_background_color text default '#070707',
  p_surface_color text default '#111111',
  p_loading_logo_url text default null,
  p_footer_text text default 'Powered by sirgaZ',
  p_hide_powered_by boolean default false
) returns public.venue_branding
language plpgsql security definer set search_path=public as $$
declare r public.venue_branding;
begin
  if not public.can_admin_venue(p_venue) then raise exception 'VENUE_ADMIN_REQUIRED'; end if;
  insert into public.venue_branding(venue_id,logo_url,primary_color,secondary_color,background_color,surface_color,loading_logo_url,footer_text,hide_powered_by)
  values(p_venue,p_logo_url,p_primary_color,p_secondary_color,p_background_color,p_surface_color,p_loading_logo_url,p_footer_text,p_hide_powered_by)
  on conflict(venue_id) do update set
    logo_url=excluded.logo_url,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
    background_color=excluded.background_color,surface_color=excluded.surface_color,loading_logo_url=excluded.loading_logo_url,
    footer_text=excluded.footer_text,hide_powered_by=excluded.hide_powered_by,updated_at=now()
  returning * into r;
  insert into public.audit_logs(actor_id,venue_id,action,entity_type,entity_id) values(auth.uid(),p_venue,'venue.branding_updated','venue_branding',p_venue);
  return r;
end; $$;
revoke all on function public.upsert_venue_branding(uuid,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.upsert_venue_branding(uuid,text,text,text,text,text,text,text,boolean) to authenticated;

-- Atomic stock-safe reward claim for venue staff.
create or replace function public.claim_catalog_reward(p_catalog uuid)
returns public.rewards language plpgsql security definer set search_path=public as $$
declare c public.venue_reward_catalog; v public.rewards; venue uuid; eid uuid;
begin
  select * into c from public.venue_reward_catalog where id=p_catalog and active=true for update;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  if not public.can_manage_venue(c.venue_id) then raise exception 'VENUE_STAFF_REQUIRED'; end if;
  if c.stock is not null and c.stock <= 0 then raise exception 'REWARD_OUT_OF_STOCK'; end if;
  if c.stock is not null then update public.venue_reward_catalog set stock=stock-1,updated_at=now() where id=c.id; end if;
  insert into public.audit_logs(actor_id,venue_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),c.venue_id,'reward.catalog_claimed','venue_reward_catalog',c.id,jsonb_build_object('title',c.title));
  return null;
end; $$;
revoke all on function public.claim_catalog_reward(uuid) from public;
grant execute on function public.claim_catalog_reward(uuid) to authenticated;

-- ============================================================
-- 6. RLS: authenticated-only, venue scoped
-- ============================================================
alter table public.markets enable row level security;
alter table public.venue_subscriptions enable row level security;
alter table public.venue_branding enable row level security;
alter table public.venue_domains enable row level security;
alter table public.venue_feature_flags enable row level security;
alter table public.event_mission_templates enable row level security;
alter table public.venue_reward_catalog enable row level security;
alter table public.webhook_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy markets_authenticated_read on public.markets for select to authenticated using(active=true);
create policy subscriptions_admin_read on public.venue_subscriptions for select to authenticated using(public.can_manage_venue(venue_id));
create policy branding_authenticated_read on public.venue_branding for select to authenticated using(true);
create policy domains_admin_all on public.venue_domains for all to authenticated using(public.can_admin_venue(venue_id)) with check(public.can_admin_venue(venue_id));
create policy feature_flags_admin_all on public.venue_feature_flags for all to authenticated using(public.can_admin_venue(venue_id)) with check(public.can_admin_venue(venue_id));
create policy mission_templates_admin_all on public.event_mission_templates for all to authenticated using(public.can_admin_venue(venue_id)) with check(public.can_admin_venue(venue_id));
create policy reward_catalog_staff_all on public.venue_reward_catalog for all to authenticated using(public.can_manage_venue(venue_id)) with check(public.can_manage_venue(venue_id));
-- Webhook and rate-limit tables are server-side only; authenticated users receive no direct access.

-- ============================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================
create index if not exists rewards_mission_idx on public.rewards(mission_id);
create index if not exists venue_rewards_event_idx on public.venue_rewards(event_id);
create index if not exists event_participants_event_status_idx on public.event_participants(event_id,status);
create index if not exists matches_event_created_idx on public.matches(event_id,created_at desc);
create index if not exists missions_match_status_idx on public.missions(match_id,status);

-- ============================================================
-- 8. LOCK DOWN REMAINING ANONYMOUS POLICIES
-- ============================================================
-- The product requires authenticated email-OTP users, so anonymous DB access is not permitted.
do $$
declare p record;
begin
  for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and policyname in (
    'blocks_self','event_feedback_self','event_missions_owner_all','event_missions_read','participants_read','participants_self_update',
    'events_owner_all','events_read','match_feedback_participant_read','matches_read','messages_read','mission_completions_read_all',
    'mission_completions_self','missions_read','missions_update','notifications_self','notifications_self_update','points_self_read',
    'profiles_read','profiles_self_update','reward_claims_owner_read','reward_claims_self','rewards_self_read','rewards_venue_redeem',
    'venue_rewards_owner_all','venue_rewards_read','venues_owner_delete','venues_owner_update','venues_read'
  ) loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

-- Recreate the most important policies with authenticated role explicitly.
create policy venues_read_authenticated on public.venues for select to authenticated using(true);
create policy venues_owner_update_authenticated on public.venues for update to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create policy venues_owner_delete_authenticated on public.venues for delete to authenticated using((select auth.uid())=owner_id);
create policy events_read_authenticated on public.events for select to authenticated using(status in ('published','live') or public.can_manage_venue(venue_id));
create policy events_owner_all_authenticated on public.events for all to authenticated using(public.can_admin_venue(venue_id)) with check(public.can_admin_venue(venue_id));
create policy profiles_read_authenticated on public.profiles for select to authenticated using(true);
create policy profiles_self_update_authenticated on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy participants_read_authenticated on public.event_participants for select to authenticated using((select auth.uid())=user_id or public.can_manage_venue((select venue_id from public.events where id=event_id)));
create policy participants_self_update_authenticated on public.event_participants for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy matches_read_authenticated on public.matches for select to authenticated using((select auth.uid())=user_a or (select auth.uid())=user_b or public.can_manage_venue((select venue_id from public.events where id=event_id)));
create policy messages_read_authenticated on public.messages for select to authenticated using(exists(select 1 from public.matches m where m.id=match_id and ((select auth.uid())=m.user_a or (select auth.uid())=m.user_b)));
create policy mission_completions_self_authenticated on public.mission_completions for select to authenticated using((select auth.uid())=user_id);
create policy missions_read_authenticated on public.missions for select to authenticated using(exists(select 1 from public.matches m where m.id=match_id and ((select auth.uid())=m.user_a or (select auth.uid())=m.user_b)));
create policy notifications_self_authenticated on public.notifications for select to authenticated using((select auth.uid())=user_id);
create policy notifications_self_update_authenticated on public.notifications for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy points_self_read_authenticated on public.points_transactions for select to authenticated using((select auth.uid())=user_id);
create policy rewards_self_read_authenticated on public.rewards for select to authenticated using((select auth.uid())=user_id);
create policy reward_claims_self_authenticated on public.reward_claims for select to authenticated using((select auth.uid())=user_id);

commit;
