#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
IMAGE="${S2_T135_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
CONTAINER="lumis-s2-t135-$RANDOM-$$"
DB_USER="supabase_admin"
STARTED=0

cleanup() {
  if [[ "$STARTED" == "1" ]]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" || -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  printf 'STOP_S2_T135_REMOTE_CREDENTIAL_PRESENT\n' >&2; exit 1
fi
docker info >/dev/null 2>&1 || { printf 'STOP_S2_T135_DOCKER_UNAVAILABLE\n' >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { printf 'STOP_S2_T135_LOCAL_IMAGE_MISSING\n' >&2; exit 1; }

docker run --detach --rm --name "$CONTAINER" \
  --env POSTGRES_PASSWORD=s2-t135-local-only --env POSTGRES_DB=lumis_s2_t135 "$IMAGE" >/dev/null
STARTED=1
for _ in {1..90}; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)" == "healthy" ]] && break
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == "healthy" ]] || {
  printf 'STOP_S2_T135_DATABASE_NOT_HEALTHY\n' >&2; exit 1;
}

apply_sql() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t135 < "$ROOT/$1" >/dev/null
}
apply_sql supabase/tests/s2-t64-local-supabase-compatibility.sql
apply_sql supabase/migrations/0001_initial_schema.sql
apply_sql supabase/migrations/0002_profile_chat_persistence.sql
apply_sql supabase/migrations/0003_care_notifications_usage.sql
apply_sql supabase/migrations/0014_authoritative_account_entitlements.sql
apply_sql supabase/migrations/0032_care_circle_backend_foundation.sql
apply_sql supabase/migrations/0034_reusable_care_pairing_operations.sql
apply_sql supabase/migrations/0037_four_digit_care_pairing_codes.sql

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t135 \
  < "$ROOT/supabase/tests/s2-t135-four-digit-pairing.sql" \
  | grep -F 'S2_T135_FOUR_DIGIT_POSTGRES17_PASSED' >/dev/null
printf 'S2_T135_FOUR_DIGIT_POSTGRES17_PASSED\n'
