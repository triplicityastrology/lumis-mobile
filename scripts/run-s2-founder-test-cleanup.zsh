#!/bin/zsh

set -euo pipefail

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
readonly PROJECT_REF="bmqhwofmdgebpcihjlnb"
MODE="preflight"
RUN_ID=""
TTY_STATE=""

while (( $# > 0 )); do
  case "$1" in
    --) shift ;;
    --execute) MODE="execute"; shift ;;
    --run-id) RUN_ID="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T108_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cleanup_environment() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  unset S2_T75_SECRET_KEY S2_T75_EXECUTE
}
trap cleanup_environment EXIT HUP INT TERM

cd "$ROOT"
node scripts/s2-founder-test-cleanup-readiness.mjs --project-ref "$PROJECT_REF"
if [[ "$MODE" != "execute" ]]; then exit 0; fi
[[ "$RUN_ID" =~ '^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$' ]] || {
  print -u2 -- "STOP_S2_T108_RUN_ID_INVALID"; exit 1;
}

print -rn -- "Paste the temporary staging sb_secret_ QA key (hidden): " >/dev/tty
TTY_STATE="$(stty -g </dev/tty)"
stty -echo </dev/tty
IFS= read -r S2_T75_SECRET_KEY </dev/tty
stty "$TTY_STATE" </dev/tty
TTY_STATE=""
print >/dev/tty
[[ "$S2_T75_SECRET_KEY" == sb_secret_* ]] || { print -u2 -- "STOP_S2_T108_QA_KEY_INVALID"; exit 1; }
export S2_T75_SECRET_KEY S2_T75_EXECUTE=CONFIRMED

node scripts/s2-care-circle-two-account-operator.mjs \
  --execute --action cleanup --project-ref "$PROJECT_REF" --run-id "$RUN_ID"
print -- "standalone_reflections_or_charts=unsupported_no_safe_authority"
print -- "device_local_demo_artifacts=unsupported_use_in_app_owner_flow"
print -- "qa_key_revocation=required_now"
print -- "temporary_credential_unset=on_exit"
