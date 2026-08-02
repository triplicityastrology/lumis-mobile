#!/bin/zsh

set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly PINNED_CLI="2.109.1"
readonly PNPM="/Users/rubyku/.local/node22/bin/pnpm"
readonly FUNCTION_NAME="profile"
readonly CONTROL="supabase/tests/s2-t106-profile-function-deployment-control.json"
MODE="preflight"
ACTION="deploy"
PAT_READY=""
TTY_STATE=""

while (( $# > 0 )); do
  case "$1" in
    --) shift ;;
    --execute) MODE="execute"; shift ;;
    --action) ACTION="${2:-}"; shift 2 ;;
    --pat-ready) PAT_READY="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T106_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cleanup_token() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  unset SUPABASE_ACCESS_TOKEN FUNCTION_LIST_JSON SECRET_LIST_JSON REVOCATION_OUTPUT
  unset PREVIOUS_EVIDENCE CURRENT_EVIDENCE REVOKE_CONFIRMED
}
trap cleanup_token EXIT HUP INT TERM

cd "$ROOT"
node scripts/s2-profile-function-deployment-readiness.mjs --project-ref "$EXPECTED_REF"
if [[ "$MODE" != "execute" ]]; then exit 0; fi
[[ "$ACTION" == "deploy" || "$ACTION" == "recover" ]] || { print -u2 -- "STOP_S2_T106_ACTION_INVALID"; exit 1; }
[[ "$PAT_READY" == "PAT_READY" ]] || { print -u2 -- "STOP_S2_T106_PAT_READY_REQUIRED"; exit 1; }
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] || { print -u2 -- "STOP_S2_T106_TOKEN_ALREADY_SET"; exit 1; }

print -rn -- "Paste the fresh temporary Supabase PAT (hidden): " >/dev/tty
TTY_STATE="$(stty -g </dev/tty)"
stty -echo </dev/tty
IFS= read -r SUPABASE_ACCESS_TOKEN </dev/tty
stty "$TTY_STATE" </dev/tty
TTY_STATE=""
print >/dev/tty
[[ -n "$SUPABASE_ACCESS_TOKEN" ]] || { print -u2 -- "STOP_S2_T106_PAT_REQUIRED"; exit 1; }
export SUPABASE_ACCESS_TOKEN

REQUIRED_NAMES="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.required_configuration_names.join(","))' "$CONTROL")"
SECRET_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" secrets list --project-ref "$EXPECTED_REF" --output json 2>/dev/null)" || {
  print -u2 -- "STOP_S2_T106_CONFIGURATION_CHECK_FAILED"; exit 1;
}
print -rn -- "$SECRET_LIST_JSON" | node scripts/validate-supabase-secret-names.mjs --required "$REQUIRED_NAMES" >/dev/null || {
  print -u2 -- "STOP_S2_T106_CONFIGURATION_CHECK_FAILED"; exit 1;
}
unset SECRET_LIST_JSON REQUIRED_NAMES

FUNCTION_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list --project-ref "$EXPECTED_REF" --output json 2>/dev/null)" || {
  print -u2 -- "STOP_S2_T106_PREVIOUS_VERSION_CAPTURE_FAILED"; exit 1;
}
PREVIOUS_EVIDENCE="$(print -rn -- "$FUNCTION_LIST_JSON" | node scripts/validate-supabase-function-list.mjs --function "$FUNCTION_NAME")" || {
  print -u2 -- "STOP_S2_T106_PREVIOUS_VERSION_CAPTURE_FAILED"; exit 1;
}
unset FUNCTION_LIST_JSON
PREVIOUS_VERSION="$(print -r -- "$PREVIOUS_EVIDENCE" | sed -n 's/^function_version=//p')"
[[ "$PREVIOUS_VERSION" == <-> ]] || { print -u2 -- "STOP_S2_T106_PREVIOUS_VERSION_CAPTURE_FAILED"; exit 1; }

# Recovery deliberately redeploys this same checksum-pinned package. A pre-T38
# source rollback is forbidden because it can restore fixture fallback.
"$PNPM" dlx "supabase@$PINNED_CLI" functions deploy "$FUNCTION_NAME" --project-ref "$EXPECTED_REF" >/dev/null || {
  print -u2 -- "STOP_S2_T106_DEPLOY_FAILED"; exit 1;
}

FUNCTION_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list --project-ref "$EXPECTED_REF" --output json 2>/dev/null)" || {
  print -u2 -- "STOP_S2_T106_POST_DEPLOY_VERIFY_FAILED"; exit 1;
}
CURRENT_EVIDENCE="$(print -rn -- "$FUNCTION_LIST_JSON" | node scripts/validate-supabase-function-list.mjs --function "$FUNCTION_NAME")" || {
  print -u2 -- "STOP_S2_T106_POST_DEPLOY_VERIFY_FAILED"; exit 1;
}
unset FUNCTION_LIST_JSON
CURRENT_VERSION="$(print -r -- "$CURRENT_EVIDENCE" | sed -n 's/^function_version=//p')"
[[ "$CURRENT_VERSION" == <-> && "$CURRENT_VERSION" -gt "$PREVIOUS_VERSION" ]] || {
  print -u2 -- "STOP_S2_T106_VERSION_NOT_ADVANCED"; exit 1;
}

FUNCTION_SHA256="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.function_sha256)' "$CONTROL")"
print -- "PROFILE_FUNCTION_DEPLOY_VERIFIED"
print -- "project_ref=$EXPECTED_REF"
print -- "action=$ACTION"
print -- "previous_function_version=$PREVIOUS_VERSION"
print -- "function_version=$CURRENT_VERSION"
print -- "function_sha256=$FUNCTION_SHA256"
print -- "Revoke the temporary PAT in Supabase Dashboard, then return here."
IFS= read -r "REVOKE_CONFIRMED?Type REVOKED after the PAT is revoked: "
[[ "$REVOKE_CONFIRMED" == "REVOKED" ]] || { print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"; exit 1; }

set +e
REVOCATION_OUTPUT="$("$PNPM" dlx "supabase@$PINNED_CLI" functions list --project-ref "$EXPECTED_REF" --output json 2>&1)"
REVOCATION_STATUS=$?
set -e
(( REVOCATION_STATUS != 0 )) || { print -u2 -- "STOP_PAT_REVOCATION_NOT_EFFECTIVE"; exit 1; }
print -rn -- "$REVOCATION_OUTPUT" | node scripts/classify-supabase-pat-revocation.mjs >/dev/null || {
  print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"; exit 1;
}
cleanup_token
trap - EXIT HUP INT TERM
print -- "PAT_REVOKE_VERIFIED"
