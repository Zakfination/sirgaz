# sirgaZ

Premium mobile-first AI matchmaking web app for clubs, festivals, concerts and nightlife.

## Stack
- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui + Framer Motion + Lucide + Recharts
- Supabase (Auth Email OTP, Postgres, RLS)
- `qrcode.react` for QR generation

## Local development

```bash
yarn install
cp .env.example .env.local  # fill in your Supabase URL + anon key
yarn dev
# open http://localhost:3000
```

## Environment variables (required)

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Public, safe in client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key | Public, safe in client |

No server-only secrets are required for the current MVP.

## Database setup

Run the migrations **in this order** in Supabase → SQL Editor (all are idempotent):

1. `supabase/schema.sql` — base schema (venues, events, participants, profiles, matches, missions, rewards + RLS)
2. `supabase/002_venue_profile.sql` — venue profile columns
3. `supabase/003_chat.sql` — chat messages
4. `supabase/004_production_security.sql` — roles, QR access tokens, server-side matching/rewards
5. `supabase/005_mvp_venue_admin.sql` — self-serve venue creation
6. `supabase/006_matchmaking_serialization.sql` — serialized legacy matching
7. `supabase/011_production_saas_completion.sql` — markets, branding, catalog (007–010 were never committed; see below)
8. `supabase/012_security_hardening.sql` — **audit fixes** (profile privacy, venue data leak, XP guard, QR token on PG < 18)
9. `supabase/013_random_matchmaking_phase1.sql` — **PRD V2 phase 1**: gender/preference, random match sessions, 3 free rerolls + wallet ledger, block & report, close event, analytics
10. `supabase/014_avatar_storage.sql` — `avatars` storage bucket for profile photos

> Migrations 007–010 exist only in the production database. Export them with
> `supabase db dump --schema public` and commit them so the repo can rebuild production.

Optional: expire quota of events whose `ends_at` passed without "End event", every 5 minutes:
`select cron.schedule('sirgaz-expire-events', '*/5 * * * *', 'select public.expire_ended_events()');`

### Database tests

`supabase/tests/run_local.sh` applies every migration to an empty Postgres (twice) and runs
`supabase/tests/phase1_security_and_matchmaking.test.sql` (PRD acceptance criteria MM/RR/PY +
security regressions). CI runs it on every PR. Never point it at production.

PRD → database/API mapping: `docs/PRD_V2_MAPPING.md`.

Also in Supabase:

- **Authentication → Providers → Email**: enable (default). Passwordless OTP is used, no password required.
- **Authentication → URL Configuration → Site URL**: set to your production URL (e.g. `https://sirgaz.com`)
- **Authentication → URL Configuration → Redirect URLs**: add
  - `https://sirgaz.com`
  - `https://www.sirgaz.com`
  - `https://<vercel-preview>.vercel.app` (add each preview host if needed)
  - `http://localhost:3000` (dev)

## Deploy to Vercel

See `DEPLOY.md` for the full checklist. TL;DR:

1. Push this repo to GitHub
2. Vercel → Add New → Project → select repo
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `.`
5. Build command: `next build` (default)
6. Install command: `yarn install` (default)
7. Output directory: `.next` (default)
8. Add the 2 environment variables above
9. Deploy → attach custom domain

## Structure

```
app/                       Next.js app router pages
├─ page.js                 Main SPA-router phone frame
├─ screens.js              30 core mobile screens (Splash → Reward)
├─ screens_extra.js        Venue Dashboard, Setup, Create Event, Manage, QR, Redeem
├─ screens_venue_live.js   Live Floor, Matches, Redeems, Analytics
├─ authContext.js          Supabase auth (Email OTP; phone code retained for future)
├─ e/[eventId]/            Public event join flow (Scan → Waiting → Match → Mission → Reward)
└─ r/[code]/               Reward redemption

lib/
├─ supabaseClient.js       @supabase/ssr browser client
├─ db.js                   All Supabase queries + RPC clients (matchmaking, block/report, admin)
└─ vibe.js                 Zodiac, age, energy, tonight helpers + computeVibeMatch

components/
└─ VibeProfile.js          Reusable VibeProfileCard + MatchReasons

supabase/
├─ schema.sql … 014_*.sql  Migrations (see "Database setup")
└─ tests/                  Postgres stub, test runner, acceptance & security checks
```

## License

Proprietary. All rights reserved.
