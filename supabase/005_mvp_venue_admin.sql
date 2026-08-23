-- sirgaZ MVP venue-admin bootstrap
begin;

create or replace function public.create_venue_for_current_user(
  p_name text,
  p_category text default 'Night Club',
  p_address text default '',
  p_description text default ''
)
returns public.venues
language plpgsql security definer set search_path=public
as $$
declare v public.venues%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'VENUE_NAME_REQUIRED'; end if;

  select * into v from public.venues where owner_id=auth.uid() limit 1;
  if found then return v; end if;

  insert into public.venues(owner_id,name,category,address,description)
  values(auth.uid(),trim(p_name),coalesce(p_category,'Night Club'),coalesce(p_address,''),coalesce(p_description,''))
  returning * into v;

  insert into public.user_roles(user_id,role,venue_id)
  values(auth.uid(),'venue_admin',v.id)
  on conflict do nothing;

  insert into public.user_roles(user_id,role,venue_id)
  values(auth.uid(),'participant',null)
  on conflict do nothing;

  insert into public.audit_logs(actor_id,venue_id,action,entity_type,entity_id)
  values(auth.uid(),v.id,'venue.created','venue',v.id);

  return v;
end;
$$;

revoke all on function public.create_venue_for_current_user(text,text,text,text) from public;
grant execute on function public.create_venue_for_current_user(text,text,text,text) to authenticated;

commit;
