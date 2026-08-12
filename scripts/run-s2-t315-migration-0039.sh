#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
case "${1:-}" in
  --apply) ACTION=APPLY_0039; PACKET=0039_dice_authority_ledger_apply.sql; EXPECT=S2_T278_MIGRATION_0039_APPLIED_AND_PROVED;;
  --rollback) ACTION=ROLLBACK_0039; PACKET=0039_dice_authority_ledger_rollback.sql; EXPECT=S2_T278_MIGRATION_0039_ROLLED_BACK_ZERO_RESIDUE;;
  *) printf 'STOP_S2_T315_MIGRATION_USAGE\n' >&2; exit 1;;
esac
[[ $# == 5 ]] || { printf 'STOP_S2_T315_MIGRATION_USAGE\n' >&2; exit 1; }
CANDIDATE="$2"; AUTHORIZATION="$3"; PUBLIC_KEY="$4"; POST_RECEIPT="$5"
# All source, proof, signature, scope, clock, and single-use gates run before database inputs are inspected.
node "$ROOT/scripts/s2-t315-migration-0039-operator.mjs" preflight --candidate "$CANDIDATE" --authorization "$AUTHORIZATION" --issuer-public-key "$PUBLIC_KEY" --action "$ACTION" >/dev/null
node "$ROOT/scripts/s2-t315-migration-0039-operator.mjs" claim --candidate "$CANDIDATE" --authorization "$AUTHORIZATION" --issuer-public-key "$PUBLIC_KEY" --action "$ACTION" >/dev/null
for name in S2_T315_DB_HOST S2_T315_DB_USER S2_T315_DB_PASSWORD; do [[ -n "${!name:-}" ]] || { printf 'STOP_S2_T315_DATABASE_INPUT_MISSING\n' >&2; exit 1; }; done
[[ "$S2_T315_DB_HOST" == db.bmqhwofmdgebpcihjlnb.supabase.co ]] || { printf 'STOP_S2_T315_WRONG_PROJECT\n' >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { printf 'STOP_S2_T315_PSQL_UNAVAILABLE\n' >&2; exit 1; }
export PGHOST="$S2_T315_DB_HOST" PGPORT=5432 PGDATABASE=postgres PGUSER="$S2_T315_DB_USER" PGPASSWORD="$S2_T315_DB_PASSWORD" PGSSLMODE=verify-full PGCONNECT_TIMEOUT=10
unset S2_T315_DB_PASSWORD
OUT="$(mktemp "${TMPDIR:-/tmp}/s2-t315-migration.XXXXXX")"
cleanup(){ rm -f "$OUT"; unset PGPASSWORD PGHOST PGPORT PGDATABASE PGUSER PGSSLMODE PGCONNECT_TIMEOUT; }
trap cleanup EXIT INT TERM
psql -X -qAt -v ON_ERROR_STOP=1 -f "$ROOT/supabase/deployment-packets/$PACKET" >"$OUT" 2>/dev/null || { printf 'STOP_S2_T315_REMOTE_SQL_FAILED\n' >&2; exit 1; }
grep -Fxq "$EXPECT" "$OUT" || { printf 'STOP_S2_T315_REDACTED_PROOF_MISSING\n' >&2; exit 1; }
node "$ROOT/scripts/s2-t315-migration-0039-operator.mjs" validate-receipt --candidate "$CANDIDATE" --receipt "$POST_RECEIPT" >/dev/null
printf '%s_RECEIPT_ACCEPTED scope=DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY provider_calls=0\n' "$ACTION"
