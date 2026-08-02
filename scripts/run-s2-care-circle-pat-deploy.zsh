#!/bin/zsh

set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly PINNED_CLI="2.109.1"
readonly PNPM="/Users/rubyku/.local/node22/bin/pnpm"
readonly FUNCTION_NAME="care-circle"
readonly SOURCE_RUNTIME_NAMES="CARE_CIRCLE_PAIRING_SECRET,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_URL"
readonly REQUIRED_CUSTOM_SECRET_NAMES="CARE_CIRCLE_PAIRING_SECRET"

MODE="preflight"
APPROVED_TECHNICAL_ANCESTOR=""
PAT_READY=""

while (( $# > 0 )); do
  case "$1" in
    --) shift ;;
    --execute) MODE="execute"; shift ;;
    --approved-technical-ancestor) APPROVED_TECHNICAL_ANCESTOR="${2:-}"; shift 2 ;;
    --pat-ready) PAT_READY="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T102_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

if [[ ! "$APPROVED_TECHNICAL_ANCESTOR" =~ '^[0-9a-f]{40}$' ]]; then
  print -u2 -- "STOP_S2_T102_TECHNICAL_ANCESTOR_REQUIRED"
  exit 1
fi
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  print -u2 -- "STOP_S2_T102_TOKEN_ALREADY_SET"
  exit 1
fi

cd "$ROOT"
node scripts/s2-care-circle-final-parity-preflight.mjs \
  --project-ref "$EXPECTED_REF" >/dev/null
node scripts/s2-care-circle-clean-descendant-authority.mjs \
  --project-ref "$EXPECTED_REF" \
  --approved-technical-ancestor "$APPROVED_TECHNICAL_ANCESTOR" >/dev/null
node scripts/s2-care-circle-function-pat-preflight.mjs \
  --project-ref "$EXPECTED_REF" \
  --approved-technical-ancestor "$APPROVED_TECHNICAL_ANCESTOR" >/dev/null
node scripts/s2-care-circle-function-config-preflight.mjs \
  --project-ref "$EXPECTED_REF" \
  --reviewed-function-sha256 "$(node -p "require('./supabase/tests/s2-t48-care-circle-function-config-control.json').function_sha256")" \
  --configuration-names "$SOURCE_RUNTIME_NAMES" >/dev/null

if [[ "$MODE" != "execute" ]]; then
  print -- "READY_FOR_PAT"
  print -- "project_ref=$EXPECTED_REF"
  print -- "approved_technical_ancestor=$APPROVED_TECHNICAL_ANCESTOR"
  print -- "head=$(git rev-parse HEAD)"
  print -- "function_name=$FUNCTION_NAME"
  print -- "network_calls=0 token_requested=0 deployment_actions=0"
  exit 0
fi
if [[ "$PAT_READY" != "PAT_READY" ]]; then
  print -u2 -- "STOP_S2_T102_PAT_READY_REQUIRED"
  exit 1
fi

cleanup_token() {
  unset SUPABASE_ACCESS_TOKEN
  unset FUNCTION_LIST_JSON SECRET_LIST_JSON SECRET_LIST_STATUS
  unset CONFIG_NAME_RESULT CONFIG_NAME_STATUS CONFIG_STOP_CODE REVOCATION_OUTPUT
}
trap cleanup_token EXIT HUP INT TERM

IFS= read -r -s "SUPABASE_ACCESS_TOKEN?Paste the fresh temporary Supabase PAT, then press Return: "
print
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  print -u2 -- "STOP_S2_T102_PAT_REQUIRED"
  exit 1
fi
export SUPABASE_ACCESS_TOKEN

set +e
SECRET_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" secrets list \
  --project-ref "$EXPECTED_REF" --output json 2>&1)"
SECRET_LIST_STATUS=$?
set -e
if (( SECRET_LIST_STATUS != 0 )); then
  CONFIG_STOP_CODE="$(print -rn -- "$SECRET_LIST_JSON" | \
    node scripts/classify-supabase-config-command.mjs "$SECRET_LIST_STATUS")"
  unset SECRET_LIST_JSON
  print -u2 -- "STOP_S2_T127_$CONFIG_STOP_CODE"
  exit 1
fi
set +e
CONFIG_NAME_RESULT="$(print -rn -- "$SECRET_LIST_JSON" | \
  node scripts/validate-supabase-secret-names.mjs \
    --required "$REQUIRED_CUSTOM_SECRET_NAMES" 2>&1)"
CONFIG_NAME_STATUS=$?
set -e
unset SECRET_LIST_JSON
if (( CONFIG_NAME_STATUS != 0 )); then
  if [[ "$CONFIG_NAME_RESULT" == "MISSING_REQUIRED_NAME" ]]; then
    print -u2 -- "STOP_S2_T127_CUSTOM_PAIRING_SECRET_MISSING"
  else
    print -u2 -- "STOP_S2_T127_CONFIG_RESPONSE_UNSAFE"
  fi
  unset CONFIG_NAME_RESULT
  exit 1
fi
unset CONFIG_NAME_RESULT

FUNCTION_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list \
  --project-ref "$EXPECTED_REF" --output json 2>/dev/null)" || {
  print -u2 -- "STOP_S2_T102_FUNCTION_PREFLIGHT_FAILED"
  exit 1
}
print -rn -- "$FUNCTION_LIST_JSON" | \
  node scripts/validate-supabase-function-list.mjs \
    --function "$FUNCTION_NAME" --allow-absent >/dev/null || {
      print -u2 -- "STOP_S2_T102_FUNCTION_PREFLIGHT_FAILED"
      exit 1
    }
unset FUNCTION_LIST_JSON

"$PNPM" dlx "supabase@$PINNED_CLI" functions deploy "$FUNCTION_NAME" \
  --project-ref "$EXPECTED_REF" >/dev/null || {
    print -u2 -- "STOP_S2_T102_DEPLOY_FAILED"
    exit 1
  }

FUNCTION_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list \
  --project-ref "$EXPECTED_REF" --output json 2>/dev/null)" || {
  print -u2 -- "STOP_S2_T102_POST_DEPLOY_VERIFY_FAILED"
  exit 1
}
FUNCTION_EVIDENCE="$(print -rn -- "$FUNCTION_LIST_JSON" | \
  node scripts/validate-supabase-function-list.mjs --function "$FUNCTION_NAME")" || {
    print -u2 -- "STOP_S2_T102_POST_DEPLOY_VERIFY_FAILED"
    exit 1
  }
unset FUNCTION_LIST_JSON

FUNCTION_SHA256="$(node -p "require('./supabase/tests/s2-t43-care-circle-function-pat-control.json').function_sha256")"
print -- "CARE_CIRCLE_INACTIVE_DEPLOY_VERIFIED"
print -- "project_ref=$EXPECTED_REF"
print -- "approved_technical_ancestor=$APPROVED_TECHNICAL_ANCESTOR"
print -- "head=$(git rev-parse HEAD)"
print -- "function_sha256=$FUNCTION_SHA256"
print -- "$FUNCTION_EVIDENCE"

print -- "Revoke the temporary PAT in Supabase Dashboard, then return here."
IFS= read -r "REVOKE_CONFIRMED?Type REVOKED after the PAT is revoked, then press Return: "
if [[ "$REVOKE_CONFIRMED" != "REVOKED" ]]; then
  print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"
  exit 1
fi

set +e
REVOCATION_OUTPUT="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list \
  --project-ref "$EXPECTED_REF" --output json 2>&1)"
REVOCATION_STATUS=$?
set -e
if (( REVOCATION_STATUS == 0 )); then
  print -u2 -- "STOP_PAT_REVOCATION_NOT_EFFECTIVE"
  exit 1
fi
if ! print -rn -- "$REVOCATION_OUTPUT" | \
  node scripts/classify-supabase-pat-revocation.mjs >/dev/null; then
  print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"
  exit 1
fi

cleanup_token
trap - EXIT HUP INT TERM
print -- "PAT_REVOKE_VERIFIED"
