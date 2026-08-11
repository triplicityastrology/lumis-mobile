#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MODE="preflight"
typeset AUTHORIZATION="" REQUEST="" CLAIM_LEDGER="" PUBLIC_KEY="" RECEIPT_OUTPUT=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --authorization) AUTHORIZATION="${2:-}"; shift 2 ;;
    --request) REQUEST="${2:-}"; shift 2 ;;
    --claim-ledger) CLAIM_LEDGER="${2:-}"; shift 2 ;;
    --microsoft-public-key) PUBLIC_KEY="${2:-}"; shift 2 ;;
    --receipt-output) RECEIPT_OUTPUT="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T298_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-t298-dice-v4-zero-call-preflight.mjs
[[ "$MODE" == "execute" ]] || exit 0

# No CLI, environment credential, network, claim, or output file is touched
# until the complete signed v4 envelope has passed the canonical validator.
[[ -n "$AUTHORIZATION" && -n "$REQUEST" && -n "$CLAIM_LEDGER" && -n "$PUBLIC_KEY" && -n "$RECEIPT_OUTPUT" ]] || { print -u2 -- "STOP_S2_T298_SEPARATE_AUTHORIZATION_REQUIRED"; exit 1; }
node --input-type=module - "$REQUEST" "$AUTHORIZATION" "$PUBLIC_KEY" <<'NODE'
import { readFile } from "node:fs/promises";
import { validateExecutionAuthorization } from "./scripts/lib/s2-t298-dice-v4-zero-call.mjs";
const [requestPath, authorizationPath, keyPath] = process.argv.slice(2);
await validateExecutionAuthorization({
  request: JSON.parse(await readFile(requestPath, "utf8")),
  receipt: JSON.parse(await readFile(authorizationPath, "utf8")),
  publicKeyPem: await readFile(keyPath, "utf8"),
});
NODE

[[ "${LUMIS_T298_RUN_REMOTE_DEPLOYMENT:-}" == "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ]] || { print -u2 -- "STOP_S2_T298_REMOTE_EXECUTION_NOT_ENABLED"; exit 1; }

LEGACY_RECEIPT="${RECEIPT_OUTPUT}.t287"
trap 'unset LUMIS_T298_RUN_REMOTE_DEPLOYMENT LUMIS_T287_RUN_REMOTE_DEPLOYMENT SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY; rm -f "$LEGACY_RECEIPT"' EXIT HUP INT TERM
LUMIS_T287_RUN_REMOTE_DEPLOYMENT="DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" \
  zsh scripts/run-s2-t287-dice-deployment.zsh --execute \
    --authorization "$AUTHORIZATION" --request "$REQUEST" --claim-ledger "$CLAIM_LEDGER" \
    --microsoft-public-key "$PUBLIC_KEY" --receipt-output "$LEGACY_RECEIPT"

node scripts/s2-t298-post-deploy-receipt.mjs \
  --request="$REQUEST" --authorization="$AUTHORIZATION" --microsoft-public-key="$PUBLIC_KEY" \
  --legacy-receipt="$LEGACY_RECEIPT" --output="$RECEIPT_OUTPUT"
print -- "S2_T298_DEFAULT_OFF_DEPLOYMENT_RECORDED provider_calls=0 model_invocations=0 migration_applied=false"
