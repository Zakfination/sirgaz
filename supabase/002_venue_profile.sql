-- ============================================================
-- sirgaZ Venue Profile migration — paste into Supabase SQL Editor → Run
-- Safe/idempotent: uses IF NOT EXISTS everywhere.
-- ============================================================

alter table public.venues add column if not exists category text;
alter table public.venues add column if not exists description text;
alter table public.venues add column if not exists instagram text;
alter table public.venues add column if not exists logo_url text;

-- Migrate any legacy demo rows to the first demo venue "Hevn Station"
update public.venues
set
  name = 'Hevn Station',
  category = 'Night Club',
  description = 'New Light Hevn 4.0',
  instagram = '@thehevn'
where name in ('My Venue', 'my venue', 'MY VENUE');

-- Also propagate the new venue name to any events that still show "My Venue"
update public.events e
set venue_name = v.name
from public.venues v
where e.venue_id = v.id
  and (e.venue_name is null or e.venue_name in ('My Venue', 'my venue', 'MY VENUE'));
