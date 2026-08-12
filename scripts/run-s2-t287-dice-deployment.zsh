#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly FUNCTION_NAME="dice-synthetic"
readonly PINNED_CLI="2.113.0"
MODE="preflight"
AUTHORIZATION=""
REQUEST=""
CLAIM_LEDGER=""
ISSUER_ISSUER_PUBLIC_KEY=""
RECEIPT_OUTPUT=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --authorization) AUTHORIZATION="${2:-}"; shift 2 ;;
    --request) REQUEST="${2:-}"; shift 2 ;;
    --claim-ledger) CLAIM_LEDGER="${2:-}"; shift 2 ;;
    --issuer-public-key) ISSUER_ISSUER_PUBLIC_KEY="${2:-}"; shift 2 ;;
    --receipt-output) RECEIPT_OUTPUT="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T287_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-t287-dice-v4-deployment-authorization.mjs
if [[ "$MODE" != "execute" ]]; then exit 0; fi

# Exact Lumis Founder authorization is validated and consumed before any future
# credential prompt, CLI construction, network call, or receipt mutation.
[[ -n "$AUTHORIZATION" && -n "$REQUEST" && -n "$CLAIM_LEDGER" && -n "$ISSUER_ISSUER_PUBLIC_KEY" && -n "$RECEIPT_OUTPUT" ]] || { print -u2 -- "STOP_S2_T287_AUTHORIZATION_REQUIRED"; exit 1; }
node scripts/s2-t287-dice-v4-deployment-authorization.mjs \
  --authorization="$AUTHORIZATION" \
  --request="$REQUEST" \
  --issuer-public-key="$ISSUER_ISSUER_PUBLIC_KEY" \
  --ledger="$CLAIM_LEDGER" \
  --consume-claim >/dev/null

# The credential and CLI boundary is intentionally after signed receipt
# validation and durable single-use claim consumption.
[[ "${LUMIS_T287_RUN_REMOTE_DEPLOYMENT:-}" == "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ]] || { print -u2 -- "STOP_S2_T287_REMOTE_EXECUTION_NOT_ENABLED"; exit 1; }
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_ANON_KEY:-}" ]] || { print -u2 -- "STOP_S2_T287_TRANSIENT_CREDENTIALS_REQUIRED"; exit 1; }

RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lumis-s2-t287.XXXXXX")"
trap 'unset SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY LUMIS_T287_RUN_REMOTE_DEPLOYMENT; rm -rf "$RUNTIME_DIR"' EXIT HUP INT TERM

pnpm exec supabase secrets list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/secrets.json"
node scripts/s2-t287-remote-deploy-proof.mjs configuration --control=config/s2-t287-dice-v4-deployment-control.json --input="$RUNTIME_DIR/secrets.json" >/dev/null
pnpm exec supabase functions list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/functions-before.json"
ROLLBACK_REVISION="$(node scripts/s2-t287-remote-deploy-proof.mjs revision --input="$RUNTIME_DIR/functions-before.json")"

pnpm exec supabase functions deploy "$FUNCTION_NAME" --project-ref "$EXPECTED_REF"

readonly FUNCTION_URL="https://${EXPECTED_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
typeset -a PROBE_NAMES=(unknown_fixture free_form_body normal_mobile_body allow_listed_fixture)
typeset -a PROBE_BODIES=(
  '{"authorization":{"fixture_id":"dice-tech-en-999"}}'
  '{"question":"synthetic"}'
  '{"fixture_id":"dice-tech-en-001"}'
  '{"authorization":{"fixture_id":"dice-tech-en-001"}}'
)
for index in {1..4}; do
  STATUS="$({
    print -r -- "header = \"apikey: ${SUPABASE_ANON_KEY}\""
    print -r -- "header = \"Authorization: Bearer ${SUPABASE_ANON_KEY}\""
  } | curl --config - --silent --show-error --output "$RUNTIME_DIR/probe-${index}.json" --write-out '%{http_code}' \
    --request POST --header 'content-type: application/json' --data "${PROBE_BODIES[$index]}" "$FUNCTION_URL")"
  node scripts/s2-t287-remote-deploy-proof.mjs probe --status="$STATUS" --input="$RUNTIME_DIR/probe-${index}.json" >/dev/null
done

pnpm exec supabase functions list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/functions-after.json"
DEPLOYED_REVISION="$(node scripts/s2-t287-remote-deploy-proof.mjs revision --input="$RUNTIME_DIR/functions-after.json")"
unset SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY LUMIS_T287_RUN_REMOTE_DEPLOYMENT
node scripts/s2-t287-remote-deploy-proof.mjs receipt \
  --control=config/s2-t287-dice-v4-deployment-control.json \
  --seal=config/s2-t287-dice-v4-deployment-package-seal.json \
  --request="$REQUEST" \
  --authorization="$AUTHORIZATION" \
  --rollback="$ROLLBACK_REVISION" \
  --deployed="$DEPLOYED_REVISION" \
  --output="$RECEIPT_OUTPUT"
node scripts/s2-t287-dice-v4-deployment-authorization.mjs \
  --authorization="$AUTHORIZATION" \
  --request="$REQUEST" \
  --issuer-public-key="$ISSUER_ISSUER_PUBLIC_KEY" \
  --deployed="$RECEIPT_OUTPUT" >/dev/null
print -- "S2_T287_DEFAULT_OFF_DEPLOYMENT_RECORDED project=exact_staging function=$FUNCTION_NAME provider_calls=0 model_invocations=0 migration_authorized=false"
