#!/bin/zsh
set -euo pipefail
readonly ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"; readonly REF="bmqhwofmdgebpcihjlnb"
MODE="preflight"; ACTION=""; RUN_ID=""; TTY_STATE=""
while (( $# > 0 )); do
  case "$1" in --) shift;; --execute) MODE="execute"; ACTION="${2:-}"; shift 2;; --run-id) RUN_ID="${2:-}"; shift 2;; *) print -u2 -- "STOP_S2_T111_ARGUMENTS_INVALID"; exit 1;; esac
done
cleanup() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  unset S2_T111_QA_KEY S2_T111_OWNER_EMAIL S2_T111_OWNER_PASSWORD S2_T111_CROSS_EMAIL S2_T111_CROSS_PASSWORD S2_T111_EXECUTE
}
trap cleanup EXIT HUP INT TERM
cd "$ROOT"
if [[ "$MODE" != "execute" ]]; then node scripts/s2-reflection-deletion-evidence.mjs --project-ref "$REF"; exit 0; fi
[[ "$ACTION" == "run" || "$ACTION" == "cleanup" ]] || { print -u2 -- "STOP_S2_T111_ACTION_INVALID"; exit 1; }
[[ "$RUN_ID" =~ '^s2t111-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$' ]] || { print -u2 -- "STOP_S2_T111_RUN_ID_INVALID"; exit 1; }
read_hidden() {
  local prompt="$1" variable="$2" value; print -rn -- "$prompt" >/dev/tty
  TTY_STATE="$(stty -g </dev/tty)"; stty -echo </dev/tty; IFS= read -r value </dev/tty
  stty "$TTY_STATE" </dev/tty; TTY_STATE=""; print >/dev/tty; printf -v "$variable" '%s' "$value"
}
read_hidden "Paste the temporary staging sb_secret_ QA key (hidden): " S2_T111_QA_KEY
[[ "$S2_T111_QA_KEY" == sb_secret_* ]] || { print -u2 -- "STOP_S2_T111_QA_KEY_INVALID"; exit 1; }
export S2_T111_QA_KEY S2_T111_EXECUTE=CONFIRMED
if [[ "$ACTION" == "run" ]]; then
  read_hidden "Owner synthetic email (hidden): " S2_T111_OWNER_EMAIL
  read_hidden "Owner password, at least 20 characters (hidden): " S2_T111_OWNER_PASSWORD
  read_hidden "Cross-owner synthetic email (hidden): " S2_T111_CROSS_EMAIL
  read_hidden "Cross-owner password, at least 20 characters and different (hidden): " S2_T111_CROSS_PASSWORD
  export S2_T111_OWNER_EMAIL S2_T111_OWNER_PASSWORD S2_T111_CROSS_EMAIL S2_T111_CROSS_PASSWORD
fi
node scripts/s2-reflection-deletion-evidence.mjs --execute --action "$ACTION" --project-ref "$REF" --run-id "$RUN_ID"
print -- "qa_key_revocation=required_now"
