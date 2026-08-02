#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
RUN_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/lumis-s2-t148-local.XXXXXX")"
DATA="$RUN_ROOT/data"; SOCKET="$RUN_ROOT/socket"; RESULTS="$RUN_ROOT/results"; PORT=$((41000 + RANDOM % 1000)); STARTED=0
mkdir -m 700 "$SOCKET" "$RESULTS"
cleanup() {
  if [[ "$STARTED" == "1" ]]; then pg_ctl -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true; fi
  rm -rf "$RUN_ROOT"
}
trap cleanup EXIT INT TERM

for command in initdb pg_ctl postgres createdb psql; do command -v "$command" >/dev/null 2>&1 || { printf 'STOP_S2_T148_LOCAL_TOOLING_INCOMPLETE\n' >&2; exit 1; }; done
postgres --version | grep -Eq 'PostgreSQL\) 17\.' || { printf 'STOP_S2_T148_LOCAL_POSTGRES_MAJOR_INVALID\n' >&2; exit 1; }
initdb -D "$DATA" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=reject --username=postgres >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCKET -h '' -p $PORT" -w start >/dev/null; STARTED=1
createdb -h "$SOCKET" -p "$PORT" -U postgres lumis_s2_t148

psql_local() { psql -X -v ON_ERROR_STOP=1 -h "$SOCKET" -p "$PORT" -U postgres -d lumis_s2_t148 "$@"; }
for file in \
  supabase/tests/s2-t64-local-supabase-compatibility.sql \
  supabase/migrations/0001_initial_schema.sql \
  supabase/migrations/0002_profile_chat_persistence.sql \
  supabase/migrations/0003_care_notifications_usage.sql \
  supabase/migrations/0014_authoritative_account_entitlements.sql \
  supabase/migrations/0032_care_circle_backend_foundation.sql \
  supabase/migrations/0033_inactive_notification_foundation.sql \
  supabase/migrations/0034_reusable_care_pairing_operations.sql \
  supabase/migrations/0037_four_digit_care_pairing_codes.sql; do psql_local -f "$ROOT/$file" >/dev/null; done
psql_local -f "$ROOT/supabase/tests/s2-t135-four-digit-pairing.sql" | grep -F 'S2_T139_FOUR_DIGIT_TRANSACTION_PASSED' >/dev/null
psql_local -f "$ROOT/supabase/tests/s2-t139-four-digit-throttle-setup.sql" >/dev/null
for attempt in {1..6}; do
  if psql_local -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.register_care_pairing_attempt_backend('90000000-0000-4000-8000-000000000001');" >"$RESULTS/attempt-$attempt.out" 2>"$RESULTS/attempt-$attempt.err"; then
    printf 'success\n' >"$RESULTS/attempt-$attempt.status"
  else
    printf 'failed\n' >"$RESULTS/attempt-$attempt.status"
  fi &
done
wait || true
allowed=0; throttled=0
for attempt in {1..6}; do
  if grep -Fxq 'success' "$RESULTS/attempt-$attempt.status"; then allowed=$((allowed + 1))
  elif grep -Fxq 'failed' "$RESULTS/attempt-$attempt.status" && grep -Fq '48004' "$RESULTS/attempt-$attempt.err"; then throttled=$((throttled + 1))
  else printf 'STOP_S2_T148_CONCURRENT_RESULT_UNSAFE\n' >&2; exit 1; fi
done
[[ "$allowed" == "5" && "$throttled" == "1" ]] || { printf 'STOP_S2_T148_CONCURRENT_LIMIT_MISMATCH\n' >&2; exit 1; }
psql_local -f "$ROOT/supabase/tests/s2-t139-four-digit-throttle-verify.sql" | grep -F 'S2_T139_CONCURRENT_THROTTLE_PASSED' >/dev/null
psql_local -f "$ROOT/supabase/tests/s2-t171-pairing-reservation-setup.sql" >/dev/null
for caree in {1..20}; do
  actor="30000000-0000-4000-8000-$(printf '%012d' "$caree")"
  request="50000000-0000-4000-8000-$(printf '%012d' "$caree")"
  code_hash="$(printf '%064x' "$caree")"
  psql_local -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.create_care_pairing_code_backend('$actor','$request','reservation:$caree','$code_hash');" >"$RESULTS/reservation-$caree.out" 2>"$RESULTS/reservation-$caree.err" &
done
wait
collision_hash="$(printf '%064x' 9999)"
for caree in 21 22; do
  actor="30000000-0000-4000-8000-$(printf '%012d' "$caree")"
  request="50000000-0000-4000-8000-$(printf '%012d' "$caree")"
  if psql_local -c "set role service_role; select set_config('request.jwt.claim.role','service_role',false); select set_config('request.jwt.claim.sub','',false); select public.create_care_pairing_code_backend('$actor','$request','collision:$caree','$collision_hash');" >"$RESULTS/collision-$caree.out" 2>"$RESULTS/collision-$caree.err"; then
    printf 'success\n' >"$RESULTS/collision-$caree.status"
  else
    printf 'failed\n' >"$RESULTS/collision-$caree.status"
  fi &
done
wait || true
collision_success=0; collision_reserved=0
for caree in 21 22; do
  [[ -f "$RESULTS/collision-$caree.status" ]] || { printf 'STOP_S2_T171_COLLISION_STATUS_MISSING\n' >&2; exit 1; }
  if grep -Fxq 'success' "$RESULTS/collision-$caree.status"; then collision_success=$((collision_success + 1))
  elif ! grep -Fxq 'failed' "$RESULTS/collision-$caree.status"; then printf 'STOP_S2_T171_COLLISION_STATUS_UNSAFE\n' >&2; exit 1
  elif grep -Fq 'CARE_PAIRING_CODE_RESERVED' "$RESULTS/collision-$caree.err"; then collision_reserved=$((collision_reserved + 1))
  else printf 'STOP_S2_T171_COLLISION_FAILURE_UNCLASSIFIED\n' >&2; exit 1; fi
done
[[ "$collision_success" == "1" && "$collision_reserved" == "1" ]] || { printf 'STOP_S2_T171_COLLISION_ATOMICITY_FAILED\n' >&2; exit 1; }
psql_local -f "$ROOT/supabase/tests/s2-t171-pairing-reservation-verify.sql" | grep -F 'S2_T171_CONCURRENT_RESERVATION_PASSED' >/dev/null
pg_ctl -D "$DATA" -m fast -w stop >/dev/null; STARTED=0
rm -rf "$RUN_ROOT"
[[ ! -e "$RUN_ROOT" ]] || { printf 'STOP_S2_T148_LOCAL_CLEANUP_FAILED\n' >&2; exit 1; }
printf 'S2_T148_FOUR_DIGIT_POSTGRES17_PASSED engine=local cleanup=confirmed\n'
