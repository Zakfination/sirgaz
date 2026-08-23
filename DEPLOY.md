# Production Deployment Checklist — sirgaZ

End-to-end path: **GitHub → Railway → Supabase → sirgaz.com**

## 1. GitHub

Repository: `Zakfination/sirgaz`

Production branch: `main`

Never commit `.env`, `.env.local`, Supabase service-role keys, database passwords, or other private credentials.

## 2. Railway — Next.js service

| Setting | Value |
|---|---|
| Builder | Railpack |
| Build command | `yarn build` |
| Start command | `yarn start` |
| Root directory | `/` |
| Healthcheck | `/` |
| Port | Railway `$PORT` |
| Node | 20.x or newer |

The app uses Next.js standalone output and `yarn start` launches `.next/standalone/server.js`.

## 3. Supabase

Production project: `dmoaeewcsjklgdhaprsq`

Apply the repository migrations in order through Supabase migrations. The currently completed production database contains the historical migrations through `010_lockdown_remaining_public_policies`; the next repository migration is:

```text
supabase/011_production_saas_completion.sql
```

This migration adds:

- market-level exclusivity
- venue subscriptions
- white-label branding
- custom/subdomain records
- feature flags
- mission templates
- reward catalog
- webhook idempotency storage
- rate-limit buckets
- venue-scoped admin helpers
- authenticated-only policy cleanup
- production indexes

## 4. Authentication

Authentication → Providers → Email:

- Email provider: ON
- Email OTP: enabled
- Configure production SMTP before high-volume events

Production redirect URLs:

```text
https://sirgaz.com
https://www.sirgaz.com
```

Only add preview URLs when they are actually used.

## 5. Venue access security

The production flow is:

```text
Venue QR
  ↓
check_in_to_event()
  ↓
venue_access_tokens
  ↓
venue_sessions
  ↓
event_participants
```

The raw QR secret is returned only when the venue creates the token; the database stores only its SHA-256 hash.

A participant must have an active, unexpired venue session before matchmaking or mission completion.

## 6. Production architecture

```text
Browser
  ↓
Next.js
  ↓
Supabase Auth
  ↓
RLS + SECURITY DEFINER RPC
  ↓
Postgres
```

The browser must not:

- enumerate the participant pool
- insert matches directly
- modify XP
- complete another user's mission
- read private matching attributes
- redeem rewards outside its venue role

## 7. SaaS model

### One market = one active venue

`markets.exclusive_venue_id` plus active-subscription uniqueness enforce venue exclusivity at the database layer.

### White label

`venue_branding`, `venue_domains`, and `venue_feature_flags` provide per-venue branding and feature configuration without code changes.

### Merchant roles

```text
super_admin
venue_admin
staff
participant
```

Venue-scoped operations are enforced by SECURITY DEFINER helpers and RLS.

## 8. Production verification

### Application

1. Open the Railway public URL.
2. Confirm landing page renders.
3. Confirm no Supabase configuration errors.
4. Confirm no browser console errors on the main customer flow.

### Authentication

1. Sign in with a real email.
2. Receive Supabase Email OTP.
3. Verify OTP.
4. Confirm session persists after refresh.

### Venue

1. Open `/merchant`.
2. Sign in with a venue admin account.
3. Create/select venue.
4. Create a live event.
5. Generate the secure venue QR.

### Physical access

1. Scan the event QR.
2. Confirm `check_in_to_event()` creates a `venue_session`.
3. Confirm the participant is registered.
4. Try the event without a valid token; sensitive actions must remain blocked.

### Matchmaking

1. Register two users in the same live event.
2. Give both active venue sessions.
3. Run matchmaking concurrently.
4. Confirm exactly one match is created.
5. Confirm the same user cannot create a second match.

### Mission / reward

1. Create a mission for a valid match.
2. Complete it through the RPC.
3. Confirm XP changes only through the trusted function.
4. Confirm reward issuance is idempotent.
5. Redeem with venue staff.
6. Repeat redemption; it must fail atomically.

### SaaS

1. Create a market.
2. Attach a venue subscription.
3. Attempt a second active venue in the same market; it must fail.
4. Configure branding.
5. Add a domain record.
6. Toggle a venue feature flag.

## 9. Security / performance gate

Run Supabase Security and Performance Advisors after every schema change. Warnings about anonymous policies, unindexed foreign keys, and duplicate permissive policies must be cleared or explicitly accepted before a production event.

## 10. Rollback

### Application

Use Railway deployment history to roll back to the last known-good deployment.

### Database

Do not delete production tables to roll back. Fix forward with a new additive migration whenever possible.

## 11. Final production gate

sirgaZ is production-ready only when:

- Railway build succeeds
- standalone runtime starts successfully
- Supabase migrations are applied
- security advisors have no high-severity findings
- authenticated-only RLS is enforced
- venue session flow passes
- matchmaking concurrency passes
- mission/reward idempotency passes
- atomic redemption passes
- market exclusivity passes
- white-label configuration passes
- production domain resolves
- Auth redirect works
