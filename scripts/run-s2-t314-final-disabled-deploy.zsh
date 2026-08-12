#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly FUNCTION_NAME="dice-synthetic"
MODE="preflight"
REQUEST=""
AUTHORIZATION=""
PUBLIC_KEY=""
CLAIM_LEDGER=""
RECEIPT_OUTPUT=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --request) REQUEST="${2:-}"; shift 2 ;;
    --authorization) AUTHORIZATION="${2:-}"; shift 2 ;;
    --issuer-public-key) PUBLIC_KEY="${2:-}"; shift 2 ;;
    --claim-ledger) CLAIM_LEDGER="${2:-}"; shift 2 ;;
    --receipt-output) RECEIPT_OUTPUT="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T314_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-t314-final-disabled-deploy.mjs readiness || [[ "$?" == "2" ]]
[[ "$MODE" == "execute" ]] || exit 0

# Receipt validation and durable single-use claim are the first executable
# boundary. No credential is read and no CLI/client is constructed above it.
[[ -n "$REQUEST" && -n "$AUTHORIZATION" && -n "$PUBLIC_KEY" && -n "$CLAIM_LEDGER" && -n "$RECEIPT_OUTPUT" ]] || {
  print -u2 -- "STOP_S2_T314_REAL_FOUNDER_SIGNED_RECEIPT_REQUIRED"
  exit 1
}
node scripts/s2-t314-final-disabled-deploy.mjs intake \
  --request="$REQUEST" --authorization="$AUTHORIZATION" \
  --issuer-public-key="$PUBLIC_KEY" --claim-ledger="$CLAIM_LEDGER" >/dev/null

[[ "${LUMIS_T314_RUN_REMOTE_DEPLOYMENT:-}" == "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ]] || {
  print -u2 -- "STOP_S2_T314_REMOTE_EXECUTION_NOT_ENABLED"
  exit 1
}
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_ANON_KEY:-}" ]] || {
  print -u2 -- "STOP_S2_T314_TRANSIENT_CREDENTIALS_REQUIRED"
  exit 1
}

RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lumis-s2-t314.XXXXXX")"
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
  local prefix="$1" status
  for index in {1..4}; do
    status="$({
      print -r -- "header = \"apikey: ${SUPABASE_ANON_KEY}\""
      print -r -- "header = \"Authorization: Bearer ${SUPABASE_ANON_KEY}\""
    } | curl --config - --silent --show-error --output "$RUNTIME_DIR/${prefix}-probe-${index}.json" --write-out '%{http_code}' \
      --request POST --header 'content-type: application/json' --data "${PROBE_BODIES[$index]}" "$FUNCTION_URL")"
    node scripts/s2-t287-remote-deploy-proof.mjs probe --status="$status" --input="$RUNTIME_DIR/${prefix}-probe-${index}.json" >/dev/null
  done
}

cleanup_and_rollback() {
  local status=$?
  if (( status != 0 && DEPLOY_ATTEMPTED == 1 && DEPLOYMENT_RECORDED == 0 )); then
    if [[ "$ROLLBACK_REVISION" == "absent" ]]; then
      pnpm exec supabase functions delete "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --yes >/dev/null 2>&1 || true
    elif [[ "$ROLLBACK_REVISION" == version-* && -f "$ROLLBACK_WORKDIR/supabase/functions/$FUNCTION_NAME/index.ts" ]]; then
      pnpm exec supabase functions deploy "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" --use-api --workdir "$ROLLBACK_WORKDIR" >/dev/null 2>&1 || true
      run_disabled_probes rollback >/dev/null 2>&1 || true
    fi
  fi
  unset LUMIS_T314_RUN_REMOTE_DEPLOYMENT SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY
  rm -rf "$RUNTIME_DIR"
  return $status
}
trap cleanup_and_rollback EXIT
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

node scripts/s2-t314-final-disabled-deploy.mjs observation \
  --rollback-revision="$ROLLBACK_REVISION" --deployed-revision="$DEPLOYED_REVISION" \
  --output="$RUNTIME_DIR/legacy-receipt.json"
unset SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY LUMIS_T314_RUN_REMOTE_DEPLOYMENT
node scripts/s2-t314-final-disabled-deploy.mjs post-receipt \
  --request="$REQUEST" --authorization="$AUTHORIZATION" \
  --issuer-public-key="$PUBLIC_KEY" --legacy-receipt="$RUNTIME_DIR/legacy-receipt.json" \
  --output="$RECEIPT_OUTPUT"
DEPLOYMENT_RECORDED=1
print -- "S2_T314_DEFAULT_OFF_DEPLOYMENT_RECORDED probes=4 provider_calls=0 model_invocations=0 migration_0039_applied=false"
