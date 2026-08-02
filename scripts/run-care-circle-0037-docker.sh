#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
IMAGE="${S2_T135_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
CONTAINER="lumis-s2-t148-$RANDOM-$$"
DB_USER="supabase_admin"
STARTED=0
RESULT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/lumis-s2-t148-docker.XXXXXX")"

cleanup() {
  if [[ "$STARTED" == "1" ]]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
  rm -rf "$RESULT_ROOT"
}
trap cleanup EXIT INT TERM

docker info >/dev/null 2>&1 || { printf 'STOP_S2_T148_DOCKER_UNAVAILABLE\n' >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { printf 'STOP_S2_T148_LOCAL_IMAGE_MISSING\n' >&2; exit 1; }
docker run --detach --rm --network none --name "$CONTAINER" \
  --env POSTGRES_PASSWORD=s2-t148-local-only --env POSTGRES_DB=lumis_s2_t148 "$IMAGE" >/dev/null
STARTED=1
for _ in {1..90}; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)" == "healthy" ]] && break
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == "healthy" ]] || { printf 'STOP_S2_T148_DATABASE_NOT_HEALTHY\n' >&2; exit 1; }

apply_sql() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 < "$ROOT/$1" >/dev/null; }
for file in \
  supabase/tests/s2-t64-local-supabase-compatibility.sql \
  supabase/migrations/0001_initial_schema.sql \
  supabase/migrations/0002_profile_chat_persistence.sql \
  supabase/migrations/0003_care_notifications_usage.sql \
  supabase/migrations/0014_authoritative_account_entitlements.sql \
  supabase/migrations/0032_care_circle_backend_foundation.sql \
  supabase/migrations/0033_inactive_notification_foundation.sql \
  supabase/migrations/0034_reusable_care_pairing_operations.sql \
  supabase/migrations/0037_four_digit_care_pairing_codes.sql; do apply_sql "$file"; done

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 < "$ROOT/supabase/tests/s2-t135-four-digit-pairing.sql" | grep -F 'S2_T139_FOUR_DIGIT_TRANSACTION_PASSED' >/dev/null
apply_sql supabase/tests/s2-t139-four-digit-throttle-setup.sql
for attempt in {1..6}; do
  if docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.register_care_pairing_attempt_backend('90000000-0000-4000-8000-000000000001');" >"$RESULT_ROOT/attempt-$attempt.out" 2>"$RESULT_ROOT/attempt-$attempt.err"; then
    printf 'success\n' >"$RESULT_ROOT/attempt-$attempt.status"
  else
    printf 'failed\n' >"$RESULT_ROOT/attempt-$attempt.status"
  fi &
done
wait || true
allowed=0; throttled=0
for attempt in {1..6}; do
  if grep -Fxq 'success' "$RESULT_ROOT/attempt-$attempt.status"; then allowed=$((allowed + 1))
  elif grep -Fxq 'failed' "$RESULT_ROOT/attempt-$attempt.status" && grep -Fq '48004' "$RESULT_ROOT/attempt-$attempt.err"; then throttled=$((throttled + 1))
  else printf 'STOP_S2_T148_CONCURRENT_RESULT_UNSAFE\n' >&2; exit 1; fi
done
[[ "$allowed" == "5" && "$throttled" == "1" ]] || { printf 'STOP_S2_T148_CONCURRENT_LIMIT_MISMATCH\n' >&2; exit 1; }
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 < "$ROOT/supabase/tests/s2-t139-four-digit-throttle-verify.sql" | grep -F 'S2_T139_CONCURRENT_THROTTLE_PASSED' >/dev/null
apply_sql supabase/tests/s2-t171-pairing-reservation-setup.sql
for caree in {1..20}; do
  actor="30000000-0000-4000-8000-$(printf '%012d' "$caree")"
  request="50000000-0000-4000-8000-$(printf '%012d' "$caree")"
  code_hash="$(printf '%064x' "$caree")"
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.create_care_pairing_code_backend('$actor','$request','reservation:$caree','$code_hash');" >"$RESULT_ROOT/reservation-$caree.out" 2>"$RESULT_ROOT/reservation-$caree.err" &
done
wait
collision_hash="$(printf '%064x' 9999)"
for caree in 21 22; do
  actor="30000000-0000-4000-8000-$(printf '%012d' "$caree")"
  request="50000000-0000-4000-8000-$(printf '%012d' "$caree")"
  if docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.create_care_pairing_code_backend('$actor','$request','collision:$caree','$collision_hash');" >"$RESULT_ROOT/collision-$caree.out" 2>"$RESULT_ROOT/collision-$caree.err"; then
    printf 'success\n' >"$RESULT_ROOT/collision-$caree.status"
  else
    printf 'failed\n' >"$RESULT_ROOT/collision-$caree.status"
  fi &
done
wait || true
collision_success=0; collision_reserved=0
for caree in 21 22; do
  [[ -f "$RESULT_ROOT/collision-$caree.status" ]] || { printf 'STOP_S2_T171_COLLISION_STATUS_MISSING\n' >&2; exit 1; }
  if grep -Fxq 'success' "$RESULT_ROOT/collision-$caree.status"; then collision_success=$((collision_success + 1))
  elif ! grep -Fxq 'failed' "$RESULT_ROOT/collision-$caree.status"; then printf 'STOP_S2_T171_COLLISION_STATUS_UNSAFE\n' >&2; exit 1
  elif grep -Fq 'CARE_PAIRING_CODE_RESERVED' "$RESULT_ROOT/collision-$caree.err"; then collision_reserved=$((collision_reserved + 1))
  else printf 'STOP_S2_T171_COLLISION_FAILURE_UNCLASSIFIED\n' >&2; exit 1; fi
done
[[ "$collision_success" == "1" && "$collision_reserved" == "1" ]] || { printf 'STOP_S2_T171_COLLISION_ATOMICITY_FAILED\n' >&2; exit 1; }
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d lumis_s2_t148 < "$ROOT/supabase/tests/s2-t171-pairing-reservation-verify.sql" | grep -F 'S2_T171_CONCURRENT_RESERVATION_PASSED' >/dev/null
docker rm -f "$CONTAINER" >/dev/null; STARTED=0
docker inspect "$CONTAINER" >/dev/null 2>&1 && { printf 'STOP_S2_T148_CONTAINER_CLEANUP_FAILED\n' >&2; exit 1; }
printf 'S2_T148_FOUR_DIGIT_POSTGRES17_PASSED engine=docker cleanup=confirmed\n'
