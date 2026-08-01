#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
IMAGE="${S2_T68_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
CONTAINER="lumis-s2-t68-$RANDOM-$$"
DB="lumis_s2_t68"
DB_USER="supabase_admin"
RESULT_ROOT="$(mktemp -d /private/tmp/lumis-s2-t68.XXXXXX)"
STARTED=0

cleanup() {
  if [[ "$STARTED" == "1" ]]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
  rm -rf "$RESULT_ROOT"
}
trap cleanup EXIT INT TERM

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" || -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  printf 'STOP_S2_T68_REMOTE_CREDENTIAL_PRESENT\n' >&2; exit 1
fi
docker info >/dev/null 2>&1 || { printf 'STOP_S2_T68_DOCKER_UNAVAILABLE\n' >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { printf 'STOP_S2_T68_LOCAL_IMAGE_MISSING\n' >&2; exit 1; }

docker run --detach --rm --name "$CONTAINER" \
  --env POSTGRES_PASSWORD=s2-t68-local-only --env POSTGRES_DB="$DB" "$IMAGE" >/dev/null
STARTED=1
for _ in {1..90}; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)" == "healthy" ]] && break
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == "healthy" ]] || {
  printf 'STOP_S2_T68_DATABASE_NOT_HEALTHY\n' >&2; exit 1;
}

apply_sql() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" < "$ROOT/$1" >/dev/null
}
apply_sql supabase/tests/s2-t64-local-supabase-compatibility.sql
apply_sql supabase/tests/s2-t68-care-circle-0034-minimal-schema.sql
apply_sql supabase/migrations/0034_reusable_care_pairing_operations.sql
apply_sql supabase/tests/s2-t68-care-circle-0034-setup.sql

pids=()
for i in {1..6}; do
  (
    carer="20000000-0000-4000-8000-$(printf '%012d' "$i")"
    request="70000000-0000-4000-8000-$(printf '%012d' "$i")"
    docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" >"$RESULT_ROOT/$i.out" 2>"$RESULT_ROOT/$i.err" <<SQL
set request.jwt.claim.role = 'service_role';
select public.accept_care_relationship_backend(
  '10000000-0000-4000-8000-000000000001',
  '$request',
  'accept-$i',
  (select id from public.care_relationships where carer_user_id = '$carer')
);
SQL
  ) &
  pids+=("$!")
done

successes=0
capacity_rejections=0
for i in {1..6}; do
  if wait "${pids[$((i - 1))]}"; then
    successes=$((successes + 1))
  elif grep -Fq '48012' "$RESULT_ROOT/$i.err"; then
    capacity_rejections=$((capacity_rejections + 1))
  else
    printf 'STOP_S2_T68_UNEXPECTED_CONCURRENT_FAILURE\n' >&2; exit 1
  fi
done

[[ "$successes" == "5" && "$capacity_rejections" == "1" ]] || {
  printf 'STOP_S2_T68_CAPACITY_RESULT_MISMATCH\n' >&2; exit 1;
}

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" \
  < "$ROOT/supabase/tests/s2-t68-care-circle-0034-verify.sql" \
  | grep -F 'S2_T68_0034_CONCURRENCY_PASSED' >/dev/null
printf 'S2_T68_0034_CONCURRENCY_PASSED\n'
