#!/bin/zsh
set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly RECEIPT="$ROOT/.lumis-local/care-circle-founder-receipt.json"
ACTION="preflight"
RUN_ID=""

while (( $# > 0 )); do
  case "$1" in
    --execute) ACTION="${2:-}"; shift 2 ;;
    --run-id) RUN_ID="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T144_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cd "$ROOT"
node scripts/s2-care-circle-four-digit-seal.mjs --check >/dev/null
if [[ ! -f "$RECEIPT" ]] || ! node scripts/s2-care-circle-founder-receipt.mjs --validate "$RECEIPT" >/dev/null 2>&1; then
  print -- "S2_T144_NOT_READY"
  print -- "reason=deployment_health_receipt_required"
  print -- "network_calls=0 credentials_requested=0 accounts_created=0"
  exit 0
fi

if [[ "$ACTION" == "preflight" ]]; then
  zsh scripts/run-s2-care-circle-bootstrap.zsh >/dev/null
  print -- "S2_T144_READY_FOR_QA_KEY"
  print -- "accounts_planned=2 evidence_schema=closed_boolean cleanup=zero_count_required"
  print -- "network_calls=0 credentials_requested=0 accounts_created=0"
  exit 0
fi

if [[ "$ACTION" != "setup" && "$ACTION" != "cleanup" ]]; then
  print -u2 -- "STOP_S2_T144_ACTION_INVALID"
  exit 1
fi
if [[ ! "$RUN_ID" =~ '^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$' ]]; then
  print -u2 -- "STOP_S2_T144_RUN_ID_INVALID"
  exit 1
fi

zsh scripts/run-s2-care-circle-bootstrap.zsh --execute "$ACTION" --run-id "$RUN_ID"
if [[ "$ACTION" == "setup" ]]; then
  print -- "S2_T144_SETUP_CONFIRMED"
  print -- "next=pnpm start:care-circle-founder"
  print -- "pairing_material_retention=transient_only"
else
  print -- "S2_T144_ZERO_RESIDUE_CONFIRMED"
  print -- "qa_key_revocation=required_now"
fi
