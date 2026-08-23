# Production Deployment Checklist — sirgaZ

End-to-end path: **GitHub → Railway → Supabase → sirgaz.com**

---

## 1. GitHub

Repository:

`Zakfination/sirgaz`

Production branch:

`main`

Never commit `.env`, `.env.local`, Supabase service-role keys, database passwords, or other private credentials.

---

## 2. Railway — Next.js service

Create/connect a Railway service to:

`Zakfination/sirgaz`

Use the `main` branch.

### Required Railway build configuration

| Setting | Value |
|---|---|
| Builder | Railpack |
| Build command | `yarn build` |
| Start command | `yarn start` |
| Root directory | `/` |
| Healthcheck | `/` |
| Port | Railway `$PORT` |
| Node | 20.x or newer supported by the repo |

**Important:** sirgaZ is a Next.js application. Do NOT use `serve -s build`; that is a Create React App/static-site command and will not serve the `.next` output correctly.

### Required Railway variables

Set these on the **sirgaZ Railway web service**, for the Production environment:

```text
NEXT_PUBLIC_SUPABASE_URL=https://dmoaeewcsjklgdhaprsq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Vz6BlwKknK5aFyw_LLiu6w_X9WL_67X
```

The `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable name is retained for application compatibility; the value is the modern Supabase publishable key.

Do not add the Supabase `service_role` key to a `NEXT_PUBLIC_*` variable.

---

## 3. Supabase

Production project:

`dmoaeewcsjklgdhaprsq`

URL:

`https://dmoaeewcsjklgdhaprsq.supabase.co`

Apply migrations in order:

```text
supabase/schema.sql
supabase/002_venue_profile.sql
supabase/003_chat.sql
supabase/004_production_security.sql
supabase/005_mvp_venue_admin.sql
supabase/006_matchmaking_serialization.sql
```

Run the SQL preflight before production launch:

```text
supabase/SECURITY_PREFLIGHT.sql
```

Do not skip the security migration. The frontend expects the RPCs and RLS rules introduced by the production-security migrations.

### Auth

Authentication → Providers → Email:

- Email provider: ON
- Email OTP: enabled
- Configure production SMTP before high-volume events

### Redirect URLs

Add the production origin used by the deployed Railway service and the final custom domain.

For production:

```text
https://sirgaz.com
https://www.sirgaz.com
```

For local development:

```text
http://localhost:3000
```

Only add preview URLs if they are actually used.

---

## 4. Venue access security

A venue QR is not the same as a public event URL.

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

The raw QR secret is only returned once when the QR is generated. The database stores its SHA-256 hash.

A participant must have an active, unexpired `venue_session` to perform sensitive actions such as matchmaking and mission completion.

---

## 5. Production architecture

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

The browser must NOT:

- insert matches directly
- create rewards directly
- modify XP
- complete another user's mission
- enumerate the participant pool
- read private matching attributes
- redeem rewards outside its venue role

---

## 6. Railway domain

After the Railway deployment succeeds:

1. Open Railway → sirgaZ service → Settings → Networking.
2. Generate a Railway public domain for initial verification.
3. Add the production custom domain `sirgaz.com`.
4. Add `www.sirgaz.com` if desired and configure the canonical redirect.
5. Use the DNS records Railway provides for the custom domain. Do not copy DNS records from an old Vercel deployment.

---

## 7. Production verification

### Application

1. Open the Railway public URL.
2. Confirm landing page renders.
3. Confirm browser console has no `getSupabase` export error.
4. Confirm there is no `supabaseUrl is required` error.

### Authentication

1. Sign in with a real email.
2. Receive Supabase Email OTP.
3. Verify OTP.
4. Confirm session persists after refresh.

### Venue

1. Open `/merchant`.
2. Sign in with venue admin email.
3. Create/select venue.
4. Create a live event.
5. Generate Secure QR.

### Physical access

1. Scan the event QR.
2. Confirm `check_in_to_event()` creates a `venue_session`.
3. Confirm the user becomes a participant.
4. Try opening the event without the access token — sensitive participation actions must remain blocked.

### Matchmaking

1. Register two users into the same live event.
2. Both must have active venue sessions.
3. Run matchmaking.
4. Confirm exactly one match is created.
5. Confirm a third user cannot force a match with either participant.

### Mission / reward

1. Create mission for a valid match.
2. Complete mission through the RPC.
3. Confirm XP increases only through the trusted function.
4. Confirm reward is issued once.
5. Redeem with venue staff.
6. Attempt a second redemption — it must fail atomically.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `getSupabase is not exported` | Ensure the latest `main` commit is deployed; `lib/supabaseClient.js` exports `getSupabase`. |
| `supabaseUrl is required` during build | Set both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the **sirgaZ Railway service** and redeploy. |
| Build succeeds but auth fails | Verify Supabase Email provider and redirect URLs. |
| `VENUE_ACCESS_REQUIRED` | User has not scanned a valid venue QR / has no active venue session. |
| `VENUE_SESSION_REQUIRED` | Session expired/revoked; scan the current venue QR again. |
| `MATCH_NOT_FOUND` | Match does not belong to the authenticated participant. |
| `REWARD_ALREADY_REDEEMED` | Reward was already atomically redeemed. |
| Railway serves a blank/static app | Check that Start Command is `yarn start`, NOT `serve -s build`. |

---

## 9. Rollback

### Application

Use Railway deployment history to roll back to the last known-good deployment.

### Database

Do not roll back SQL by deleting tables. The production migrations are designed to be additive. Fix forward with a new migration whenever possible.

---

## 10. Final production gate

sirgaZ is considered production-ready only when:

- Railway build succeeds
- Railway runtime starts successfully
- Supabase environment variables are present
- Supabase migrations are applied
- RLS preflight passes
- venue session flow passes
- matchmaking concurrency test passes
- mission/reward test passes
- atomic redemption test passes
- production domain resolves
- Auth redirect works

