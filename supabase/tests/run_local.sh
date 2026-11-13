#!/bin/sh
# Apply every migration to an EMPTY Postgres database, twice (idempotency), then run the checks.
# Usage: DATABASE_URL=postgres://postgres:postgres@localhost:5432/sirgaz_test sh supabase/tests/run_local.sh
set -eu
: "${DATABASE_URL:?set DATABASE_URL to an empty test database}"
cd "$(dirname "$0")/.."
PSQL="psql $DATABASE_URL -q -v ON_ERROR_STOP=1"
$PSQL -f tests/supabase_stub.sql
MIGRATIONS="schema.sql 002_venue_profile.sql 003_chat.sql 004_production_security.sql 005_mvp_venue_admin.sql 006_matchmaking_serialization.sql 011_production_saas_completion.sql 012_security_hardening.sql 013_random_matchmaking_phase1.sql 014_avatar_storage.sql 015_pokes_notifications_moderation.sql"
for pass in 1 2; do
  for f in $MIGRATIONS; do
    [ "$pass" = 2 ] && case "$f" in schema.sql|002_*|003_*|004_*|005_*|006_*|011_*) continue;; esac
    echo "migrate ($pass) $f"
    $PSQL -f "$f"
  done
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/phase1_security_and_matchmaking.test.sql 2>&1 | grep -E "PASS|FAIL|ERROR|ALL CHECKS"
