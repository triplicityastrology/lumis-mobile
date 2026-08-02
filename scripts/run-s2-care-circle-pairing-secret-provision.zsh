#!/bin/zsh

set -euo pipefail
unsetopt bg_nice

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly EXPECTED_REF="bmqhwofmdgebpcihjlnb"
readonly PINNED_CLI="2.109.1"
readonly PNPM="/Users/rubyku/.local/node22/bin/pnpm"
readonly SECRET_NAME="CARE_CIRCLE_PAIRING_SECRET"

MODE="preflight"
PAT_READY=""
PROVISION_APPROVED=""
TTY_STATE=""
SECRET_FIFO=""
SECRET_FIFO_DIR=""
SECRET_WRITER_PID=""

while (( $# > 0 )); do
  case "$1" in
    --execute) MODE="execute"; shift ;;
    --pat-ready) PAT_READY="${2:-}"; shift 2 ;;
    --provision-approved) PROVISION_APPROVED="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T130_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cleanup() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  if [[ -n "$SECRET_WRITER_PID" ]]; then
    kill "$SECRET_WRITER_PID" 2>/dev/null || true
    wait "$SECRET_WRITER_PID" 2>/dev/null || true
  fi
  if [[ -n "$SECRET_FIFO" && -p "$SECRET_FIFO" ]]; then rm -f -- "$SECRET_FIFO"; fi
  if [[ -n "$SECRET_FIFO_DIR" && -d "$SECRET_FIFO_DIR" ]]; then rmdir -- "$SECRET_FIFO_DIR" 2>/dev/null || true; fi
  unset SUPABASE_ACCESS_TOKEN PAIRING_SECRET SECRET_LIST_JSON COMMAND_OUTPUT
  unset COMMAND_STATUS CLASSIFICATION REVOKE_CONFIRMED REVOCATION_OUTPUT SECRET_FIFO SECRET_FIFO_DIR SECRET_WRITER_PID
}
trap cleanup EXIT HUP INT TERM

cd "$ROOT"
[[ "$(git status --porcelain=v1)" == "" ]] || { print -u2 -- "STOP_S2_T130_TREE_DIRTY"; exit 1; }
[[ -f supabase/.temp/project-ref ]] || { print -u2 -- "STOP_S2_T130_PROJECT_REF_MISMATCH"; exit 1; }
[[ "$(tr -d '[:space:]' < supabase/.temp/project-ref)" == "$EXPECTED_REF" ]] || {
  print -u2 -- "STOP_S2_T130_PROJECT_REF_MISMATCH"; exit 1;
}
node scripts/s2-care-circle-function-config-preflight.mjs \
  --project-ref "$EXPECTED_REF" \
  --reviewed-function-sha256 "$(node -p "require('./supabase/tests/s2-t48-care-circle-function-config-control.json').function_sha256")" \
  --configuration-names "CARE_CIRCLE_PAIRING_SECRET,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_URL" >/dev/null

if [[ "$MODE" != "execute" ]]; then
  print -- "READY_FOR_PAIRING_SECRET_PROVISION"
  print -- "project_ref=$EXPECTED_REF"
  print -- "custom_secret_name=$SECRET_NAME"
  print -- "platform_runtime_names=source_authorized_not_custom_secrets"
  print -- "network_calls=0 token_requested=0 secret_generated=0 secret_set=0"
  exit 0
fi

[[ "$PAT_READY" == "PAT_READY" ]] || { print -u2 -- "STOP_S2_T130_PAT_READY_REQUIRED"; exit 1; }
[[ "$PROVISION_APPROVED" == "PROVISION_APPROVED" ]] || { print -u2 -- "STOP_S2_T130_PROVISION_APPROVAL_REQUIRED"; exit 1; }
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] || { print -u2 -- "STOP_S2_T130_TOKEN_ALREADY_SET"; exit 1; }

print -rn -- "Paste the fresh temporary Supabase PAT (hidden): " >/dev/tty
TTY_STATE="$(stty -g </dev/tty)"
stty -echo </dev/tty
IFS= read -r SUPABASE_ACCESS_TOKEN </dev/tty
stty "$TTY_STATE" </dev/tty
TTY_STATE=""
print >/dev/tty
[[ -n "$SUPABASE_ACCESS_TOKEN" ]] || { print -u2 -- "STOP_S2_T130_PAT_REQUIRED"; exit 1; }
export SUPABASE_ACCESS_TOKEN

PAIRING_SECRET="$(openssl rand -hex 32 2>/dev/null)" || { print -u2 -- "STOP_S2_T130_LOCAL_GENERATION_FAILED"; exit 1; }
[[ "$PAIRING_SECRET" =~ '^[0-9a-f]{64}$' ]] || { print -u2 -- "STOP_S2_T130_LOCAL_GENERATION_FAILED"; exit 1; }

SECRET_FIFO_DIR="$(mktemp -d "${TMPDIR:-/private/tmp}/lumis-care-circle-secret.XXXXXX")" || {
  print -u2 -- "STOP_S2_T130_SECRET_HANDOFF_FAILED"; exit 1;
}
chmod 700 "$SECRET_FIFO_DIR" || { print -u2 -- "STOP_S2_T130_SECRET_HANDOFF_FAILED"; exit 1; }
SECRET_FIFO="$SECRET_FIFO_DIR/value.fifo"
mkfifo -m 600 "$SECRET_FIFO" || { print -u2 -- "STOP_S2_T130_SECRET_HANDOFF_FAILED"; exit 1; }
(
  umask 077
  print -r -- "${SECRET_NAME}=${PAIRING_SECRET}" > "$SECRET_FIFO"
) &
SECRET_WRITER_PID=$!
unset PAIRING_SECRET

set +e
COMMAND_OUTPUT="$("$PNPM" dlx "supabase@$PINNED_CLI" secrets set \
  --project-ref "$EXPECTED_REF" --env-file "$SECRET_FIFO" 2>&1)"
COMMAND_STATUS=$?
wait "$SECRET_WRITER_PID" 2>/dev/null
SECRET_WRITER_STATUS=$?
set -e
SECRET_WRITER_PID=""
rm -f -- "$SECRET_FIFO"
SECRET_FIFO=""
rmdir -- "$SECRET_FIFO_DIR"
SECRET_FIFO_DIR=""
if (( SECRET_WRITER_STATUS != 0 )); then
  unset COMMAND_OUTPUT
  print -u2 -- "STOP_S2_T130_SECRET_HANDOFF_FAILED"
  exit 1
fi
if (( COMMAND_STATUS != 0 )); then
  CLASSIFICATION="$(print -rn -- "$COMMAND_OUTPUT" | node scripts/classify-supabase-config-command.mjs "$COMMAND_STATUS")"
  unset COMMAND_OUTPUT
  print -u2 -- "STOP_S2_T130_SECRET_SET_${CLASSIFICATION#CONFIG_}"
  exit 1
fi
unset COMMAND_OUTPUT

set +e
SECRET_LIST_JSON="$("$PNPM" dlx "supabase@$PINNED_CLI" secrets list \
  --project-ref "$EXPECTED_REF" --output json 2>&1)"
COMMAND_STATUS=$?
set -e
if (( COMMAND_STATUS != 0 )); then
  CLASSIFICATION="$(print -rn -- "$SECRET_LIST_JSON" | node scripts/classify-supabase-config-command.mjs "$COMMAND_STATUS")"
  unset SECRET_LIST_JSON
  print -u2 -- "STOP_S2_T130_SECRET_VERIFY_${CLASSIFICATION#CONFIG_}"
  exit 1
fi
print -rn -- "$SECRET_LIST_JSON" | node scripts/validate-supabase-secret-names.mjs \
  --required "$SECRET_NAME" >/dev/null || {
    unset SECRET_LIST_JSON
    print -u2 -- "STOP_S2_T130_SECRET_VERIFY_RESPONSE_UNSAFE"
    exit 1
  }
unset SECRET_LIST_JSON

print -- "PAIRING_SECRET_NAME_VERIFIED"
print -- "project_ref=$EXPECTED_REF"
print -- "custom_secret_name=$SECRET_NAME"
print -- "secret_value_exposed=false"
print -- "Revoke the temporary PAT in Supabase Dashboard, then return here."
IFS= read -r "REVOKE_CONFIRMED?Type REVOKED after the PAT is revoked: "
[[ "$REVOKE_CONFIRMED" == "REVOKED" ]] || { print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"; exit 1; }

set +e
REVOCATION_OUTPUT="$("$PNPM" dlx "supabase@$PINNED_CLI" secrets list \
  --project-ref "$EXPECTED_REF" --output json 2>&1)"
COMMAND_STATUS=$?
set -e
(( COMMAND_STATUS != 0 )) || { print -u2 -- "STOP_PAT_REVOCATION_NOT_EFFECTIVE"; exit 1; }
print -rn -- "$REVOCATION_OUTPUT" | node scripts/classify-supabase-pat-revocation.mjs >/dev/null || {
  print -u2 -- "STOP_PAT_REVOCATION_UNVERIFIED"; exit 1;
}
cleanup
trap - EXIT HUP INT TERM
print -- "PAT_REVOKE_VERIFIED"
