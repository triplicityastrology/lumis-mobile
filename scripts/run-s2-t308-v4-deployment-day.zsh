#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly FUNCTION_NAME="dice-synthetic"
MODE="preflight"
AUTHORIZATION=""
REQUEST=""
CLAIM_LEDGER=""
ISSUER_PUBLIC_KEY=""
RECEIPT_OUTPUT=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --authorization) AUTHORIZATION="${2:-}"; shift 2 ;;
    --request) REQUEST="${2:-}"; shift 2 ;;
    --claim-ledger) CLAIM_LEDGER="${2:-}"; shift 2 ;;
    --issuer-public-key) ISSUER_PUBLIC_KEY="${2:-}"; shift 2 ;;
    --receipt-output) RECEIPT_OUTPUT="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T308_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-t308-v4-receipt-intake.mjs
[[ "$MODE" == "execute" ]] || exit 0

# Everything below this line remains unreachable until all closed receipt
# inputs exist. Validation and the durable single-use claim happen before any
# credential read, CLI construction, network call, or output receipt write.
[[ -n "$AUTHORIZATION" && -n "$REQUEST" && -n "$CLAIM_LEDGER" && -n "$ISSUER_PUBLIC_KEY" && -n "$RECEIPT_OUTPUT" ]] || { print -u2 -- "STOP_S2_T308_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED"; exit 1; }
node scripts/s2-t308-v4-receipt-intake.mjs \
  --authorization="$AUTHORIZATION" --request="$REQUEST" \
  --issuer-public-key="$ISSUER_PUBLIC_KEY" --ledger="$CLAIM_LEDGER" >/dev/null

[[ "${LUMIS_T308_RUN_REMOTE_DEPLOYMENT:-}" == "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ]] || { print -u2 -- "STOP_S2_T308_REMOTE_EXECUTION_NOT_ENABLED"; exit 1; }
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_ANON_KEY:-}" ]] || { print -u2 -- "STOP_S2_T308_TRANSIENT_CREDENTIALS_REQUIRED"; exit 1; }

RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lumis-s2-t308.XXXXXX")"
ROLLBACK_WORKDIR="$RUNTIME_DIR/rollback-workdir"
ROLLBACK_REVISION=""
DEPLOY_ATTEMPTED=0
DEPLOYMENT_RECORDED=0
readonly FUNCTION_URL="https://${EXPECTED_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
typeset -a PROBE_BODIES=(
  '{"authorization":{"fixture_id":"dice-tech-en-999"}}'
  '{"question":"synthetic"}'
  '{"fixture_id":"dice-tech-en-001"}'
  '{"authorization":{"fixture_id":"dice-tech-en-001"}}'
)

run_disabled_probes() {
  local prefix="$1"
  local status
  for index in {1..4}; do
    status="$({
      print -r -- "header = \"apikey: ${SUPABASE_ANON_KEY}\""
      print -r -- "header = \"Authorization: Bearer ${SUPABASE_ANON_KEY}\""
    } | curl --config - --silent --show-error --output "$RUNTIME_DIR/${prefix}-probe-${index}.json" --write-out '%{http_code}' \
      --request POST --header 'content-type: application/json' --data "${PROBE_BODIES[$index]}" "$FUNCTION_URL")"
    node scripts/s2-t287-remote-deploy-proof.mjs probe --status="$status" --input="$RUNTIME_DIR/${prefix}-probe-${index}.json" >/dev/null
  done
}

rollback_if_needed() {
  local status=$?
  if (( status != 0 && DEPLOY_ATTEMPTED == 1 && DEPLOYMENT_RECORDED == 0 )); then
    if [[ "$ROLLBACK_REVISION" == "absent" ]]; then
      if pnpm exec supabase functions delete "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --yes >/dev/null 2>&1 \
        && pnpm exec supabase functions list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/functions-rollback.json" \
        && [[ "$(node scripts/s2-t287-remote-deploy-proof.mjs revision --input="$RUNTIME_DIR/functions-rollback.json")" == "absent" ]]; then
        print -u2 -- "S2_T308_AUTOMATIC_ROLLBACK_CONFIRMED restored=absent"
      else
        print -u2 -- "STOP_S2_T308_AUTOMATIC_ROLLBACK_FAILED"
      fi
    elif [[ "$ROLLBACK_REVISION" == version-* && -f "$ROLLBACK_WORKDIR/supabase/functions/$FUNCTION_NAME/index.ts" ]]; then
      if pnpm exec supabase functions deploy "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --use-api --workdir "$ROLLBACK_WORKDIR" >/dev/null 2>&1 \
        && run_disabled_probes rollback; then
        print -u2 -- "S2_T308_AUTOMATIC_ROLLBACK_CONFIRMED restored=$ROLLBACK_REVISION"
      else
        print -u2 -- "STOP_S2_T308_AUTOMATIC_ROLLBACK_FAILED"
      fi
    else
      print -u2 -- "STOP_S2_T308_AUTOMATIC_ROLLBACK_SOURCE_MISSING"
    fi
  fi
  unset LUMIS_T308_RUN_REMOTE_DEPLOYMENT SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY
  rm -rf "$RUNTIME_DIR"
  return $status
}
trap rollback_if_needed EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$ROLLBACK_WORKDIR/supabase/functions"
cp supabase/config.toml "$ROLLBACK_WORKDIR/supabase/config.toml"
pnpm exec supabase secrets list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/secrets.json"
node scripts/s2-t287-remote-deploy-proof.mjs configuration --control=config/s2-t287-dice-v4-deployment-control.json --input="$RUNTIME_DIR/secrets.json" >/dev/null
pnpm exec supabase functions list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/functions-before.json"
ROLLBACK_REVISION="$(node scripts/s2-t287-remote-deploy-proof.mjs revision --input="$RUNTIME_DIR/functions-before.json")"
if [[ "$ROLLBACK_REVISION" != "absent" ]]; then
  pnpm exec supabase functions download "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --use-api --workdir "$ROLLBACK_WORKDIR" >/dev/null
fi

DEPLOY_ATTEMPTED=1
pnpm exec supabase functions deploy "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --use-api
run_disabled_probes postdeploy

pnpm exec supabase functions list --project-ref "$EXPECTED_REF" --output json > "$RUNTIME_DIR/functions-after.json"
DEPLOYED_REVISION="$(node scripts/s2-t287-remote-deploy-proof.mjs revision --input="$RUNTIME_DIR/functions-after.json")"
unset SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY LUMIS_T308_RUN_REMOTE_DEPLOYMENT
node scripts/s2-t287-remote-deploy-proof.mjs receipt \
  --control=config/s2-t287-dice-v4-deployment-control.json \
  --seal=config/s2-t287-dice-v4-deployment-package-seal.json \
  --request="$REQUEST" --authorization="$AUTHORIZATION" \
  --rollback="$ROLLBACK_REVISION" --deployed="$DEPLOYED_REVISION" \
  --output="$RUNTIME_DIR/legacy-receipt.json"
node scripts/s2-t298-post-deploy-receipt.mjs \
  --request="$REQUEST" --authorization="$AUTHORIZATION" --issuer-public-key="$ISSUER_PUBLIC_KEY" \
  --legacy-receipt="$RUNTIME_DIR/legacy-receipt.json" --output="$RECEIPT_OUTPUT"
DEPLOYMENT_RECORDED=1
print -- "S2_T308_DEFAULT_OFF_DEPLOYMENT_RECORDED probes=4 provider_calls=0 model_invocations=0 migration_0039_applied=false"
