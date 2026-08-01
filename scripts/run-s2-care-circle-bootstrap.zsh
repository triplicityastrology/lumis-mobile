#!/bin/zsh

set -euo pipefail

readonly ROOT="/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
readonly PROJECT_REF="bmqhwofmdgebpcihjlnb"
ACTION="preflight"
RUN_ID=""
TTY_STATE=""

while (( $# > 0 )); do
  case "$1" in
    --) shift ;;
    --execute) ACTION="${2:-}"; shift 2 ;;
    --run-id) RUN_ID="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T103_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cleanup_environment() {
  if [[ -n "$TTY_STATE" ]]; then
    stty "$TTY_STATE" </dev/tty 2>/dev/null || true
  fi
  unset S2_T75_SECRET_KEY S2_T75_CAREE_EMAIL S2_T75_CAREE_PASSWORD
  unset S2_T75_CARER_EMAIL S2_T75_CARER_PASSWORD S2_T75_EXECUTE
}
trap cleanup_environment EXIT HUP INT TERM

[[ "$PWD" == "$ROOT" ]] || {
  print -u2 -- "STOP_S2_T103_WRONG_WORKTREE"
  exit 1
}

if [[ "$ACTION" == "preflight" ]]; then
  node scripts/s2-care-circle-two-account-operator.mjs \
    --project-ref "$PROJECT_REF" >/dev/null
  print -- "READY_FOR_QA_KEY"
  print -- "project_ref=$PROJECT_REF"
  print -- "accounts_planned=2"
  print -- "network_calls=0 credentials_requested=0 accounts_created=0"
  exit 0
fi

if [[ "$ACTION" != "setup" && "$ACTION" != "cleanup" ]]; then
  print -u2 -- "STOP_S2_T103_ACTION_INVALID"
  exit 1
fi
if [[ ! "$RUN_ID" =~ '^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$' ]]; then
  print -u2 -- "STOP_S2_T103_RUN_ID_INVALID"
  exit 1
fi

read_hidden() {
  local prompt="$1" variable="$2" value
  print -rn -- "$prompt" >/dev/tty
  TTY_STATE="$(stty -g </dev/tty)"
  stty -echo </dev/tty
  IFS= read -r value </dev/tty
  stty "$TTY_STATE" </dev/tty
  TTY_STATE=""
  print >/dev/tty
  printf -v "$variable" '%s' "$value"
}

read_hidden "Paste the temporary staging sb_secret_ QA key (hidden): " S2_T75_SECRET_KEY
if [[ "$S2_T75_SECRET_KEY" != sb_secret_* ]]; then
  print -u2 -- "STOP_S2_T103_QA_KEY_INVALID"
  exit 1
fi
export S2_T75_SECRET_KEY S2_T75_EXECUTE=CONFIRMED

if [[ "$ACTION" == "setup" ]]; then
  print -- "Enter the two synthetic credentials at hidden prompts. They are not stored or echoed."
  read_hidden "Caree synthetic email (hidden): " S2_T75_CAREE_EMAIL
  read_hidden "Caree test password, minimum 20 characters (hidden): " S2_T75_CAREE_PASSWORD
  read_hidden "Carer synthetic email (hidden): " S2_T75_CARER_EMAIL
  read_hidden "Carer test password, minimum 20 characters and different (hidden): " S2_T75_CARER_PASSWORD
  export S2_T75_CAREE_EMAIL S2_T75_CAREE_PASSWORD
  export S2_T75_CARER_EMAIL S2_T75_CARER_PASSWORD
fi

node scripts/s2-care-circle-two-account-operator.mjs \
  --execute --action "$ACTION" --project-ref "$PROJECT_REF" --run-id "$RUN_ID"

if [[ "$ACTION" == "cleanup" ]]; then
  print -- "qa_key_revocation=required_now"
fi
print -- "temporary_credentials_unset=on_exit"
