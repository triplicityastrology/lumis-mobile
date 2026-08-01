#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
IMAGE="${S2_T87_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
CONTAINER="lumis-s2-t87-$RANDOM-$$"
PASSWORD="s2-t87-local-only"
DB="lumis_s2_t87"
DB_USER="supabase_admin"
STARTED=0

cleanup() {
  if [[ "$STARTED" == "1" ]]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" || -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  printf 'STOP_S2_T87_REMOTE_CREDENTIAL_PRESENT\n' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then printf 'STOP_S2_T87_DOCKER_UNAVAILABLE\n' >&2; exit 1; fi
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  printf 'STOP_S2_T87_LOCAL_IMAGE_MISSING\n' >&2
  exit 1
fi

docker run --detach --rm --name "$CONTAINER" \
  --env POSTGRES_PASSWORD="$PASSWORD" --env POSTGRES_DB="$DB" "$IMAGE" >/dev/null
STARTED=1
for _ in {1..90}; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)" == "healthy" ]] && break
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == "healthy" ]] || {
  printf 'STOP_S2_T87_DATABASE_NOT_HEALTHY\n' >&2
  exit 1
}

apply_sql() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" \
    < "$ROOT/$1" >/dev/null
}
apply_sql supabase/tests/s2-t64-local-supabase-compatibility.sql
apply_sql supabase/migrations/0001_initial_schema.sql
apply_sql supabase/migrations/0002_profile_chat_persistence.sql
apply_sql supabase/migrations/0036_owner_safe_reflection_deletion.sql

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" \
  < "$ROOT/supabase/tests/s2-t87-reflection-deletion-local.sql" \
  | grep -F 'S2_T87_REFLECTION_DELETION_LOCAL_PROOF_PASSED' >/dev/null

docker rm -f "$CONTAINER" >/dev/null
STARTED=0
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  printf 'STOP_S2_T87_CONTAINER_CLEANUP_FAILED\n' >&2
  exit 1
fi
printf 'S2_T87_REFLECTION_DELETION_LOCAL_PROOF_PASSED\n'
printf 'S2_T87_LOCAL_CONTAINER_CLEANUP_CONFIRMED\n'
