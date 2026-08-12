#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MODE="preflight"
typeset AUTHORIZATION="" REQUEST="" CLAIM_LEDGER="" ISSUER_PUBLIC_KEY="" RECEIPT_OUTPUT=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --authorization) AUTHORIZATION="${2:-}"; shift 2 ;;
    --request) REQUEST="${2:-}"; shift 2 ;;
    --claim-ledger) CLAIM_LEDGER="${2:-}"; shift 2 ;;
    --issuer-public-key) ISSUER_PUBLIC_KEY="${2:-}"; shift 2 ;;
    --receipt-output) RECEIPT_OUTPUT="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T303_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-t303-dice-default-off-preflight.mjs
[[ "$MODE" == "execute" ]] || exit 0

# Missing authorization stops before reading a key/credential, constructing a
# client, reserving a claim, mutating a receipt, or invoking a remote command.
[[ -n "$AUTHORIZATION" && -n "$REQUEST" && -n "$CLAIM_LEDGER" && -n "$ISSUER_PUBLIC_KEY" && -n "$RECEIPT_OUTPUT" ]] || { print -u2 -- "STOP_S2_T303_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED"; exit 1; }
node --input-type=module - "$REQUEST" "$AUTHORIZATION" "$ISSUER_PUBLIC_KEY" <<'NODE'
import { readFile } from "node:fs/promises";
import { validateOperationalAuthorization } from "./scripts/lib/s2-t303-dice-default-off-final.mjs";
const [requestPath, authorizationPath, keyPath] = process.argv.slice(2);
await validateOperationalAuthorization({
  request: JSON.parse(await readFile(requestPath, "utf8")),
  receipt: JSON.parse(await readFile(authorizationPath, "utf8")),
  publicKeyPem: await readFile(keyPath, "utf8"),
});
NODE

[[ "${LUMIS_T303_RUN_REMOTE_DEPLOYMENT:-}" == "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ]] || { print -u2 -- "STOP_S2_T303_REMOTE_EXECUTION_NOT_ENABLED"; exit 1; }

trap 'unset LUMIS_T303_RUN_REMOTE_DEPLOYMENT LUMIS_T298_RUN_REMOTE_DEPLOYMENT LUMIS_T287_RUN_REMOTE_DEPLOYMENT SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY' EXIT HUP INT TERM
LUMIS_T298_RUN_REMOTE_DEPLOYMENT="DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" \
  zsh scripts/run-s2-t298-dice-v4-zero-call-deployment.zsh --execute \
    --authorization "$AUTHORIZATION" --request "$REQUEST" --claim-ledger "$CLAIM_LEDGER" \
    --issuer-public-key "$ISSUER_PUBLIC_KEY" --receipt-output "$RECEIPT_OUTPUT"
print -- "S2_T303_DEFAULT_OFF_DEPLOYMENT_RECORDED provider_calls=0 model_invocations=0 migration_0039_applied=false"
