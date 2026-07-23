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

Run both SQL migrations in Supabase → SQL Editor:

1. `supabase/schema.sql` — base schema (venues, events, participants, profiles, matches, missions, rewards + RLS)
2. `supabase/002_venue_profile.sql` — adds venue profile columns (category, description, instagram, logo_url) + migrates any legacy "My Venue" rows

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
├─ db.js                   All Supabase queries (venues, events, matches, missions, rewards)
└─ vibe.js                 Zodiac, age, energy, tonight helpers + computeVibeMatch

components/
└─ VibeProfile.js          Reusable VibeProfileCard + MatchReasons

supabase/
├─ schema.sql              Base tables + RLS
└─ 002_venue_profile.sql   Venue profile columns migration
```

## License

Proprietary. All rights reserved.
