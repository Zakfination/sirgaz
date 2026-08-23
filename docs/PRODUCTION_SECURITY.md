# sirgaZ Production Security

## What changed

- Supabase/RLS is the only production data boundary.
- Legacy Mongo catch-all `/api/*` is disabled.
- Venue admin/staff/participant/super-admin roles are represented in `user_roles`.
- Existing venue owners are backfilled as `venue_admin`; existing profiles as `participant`.
- Venue QR secrets are stored only as SHA-256 hashes.
- `venue_sessions` gates check-in, matchmaking and mission completion.
- Participant/profile reads are scoped; the client no longer receives the full participant pool.
- Matchmaking is performed by the `find_match()` security-definer RPC.
- Mission completion and XP/reward issuance are atomic server-side operations.
- Reward redemption is atomic and venue-scoped.
- Sensitive actions are written to `audit_logs`.

## Migration order

1. Existing sirgaZ migrations.
2. `004_production_security.sql`.
3. `005_mvp_venue_admin.sql`.
4. Run `SECURITY_PREFLIGHT.sql` and confirm expected-zero checks.

## Venue QR flow

1. Venue admin signs in with email OTP.
2. Venue admin creates/selects an event.
3. Venue admin calls `create_venue_access_token(event_id)`.
4. The returned raw secret is used once to render the venue QR URL.
5. Database stores only the SHA-256 hash.
6. User scans QR and authenticates.
7. `check_in_to_event(event_id, token)` creates the expiring `venue_session`.
8. `find_match(event_id)` requires an active session.

## Security invariants

A participant must never be able to:

- read the entire participant pool;
- read private matching attributes of another participant;
- insert/update/delete a match directly;
- create a reward directly;
- grant themselves XP;
- complete another participant's mission;
- redeem a reward outside their venue;
- use an expired/revoked venue session.

## Important deployment note

The migration is intentionally additive. Take a database backup before applying it. Do not delete existing data to make the migration pass. If a preflight check reports unexpected legacy data, resolve the data issue before adding any final unique constraint.
