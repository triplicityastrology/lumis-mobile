#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PROJECT_REF="bmqhwofmdgebpcihjlnb"
ACTION="${1:-preflight}"
RUN_ID="${2:-}"
TTY_STATE=""

cleanup() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  unset S2_T75_SECRET_KEY S2_T75_CAREE_EMAIL S2_T75_CAREE_PASSWORD
  unset S2_T75_CARER_EMAIL S2_T75_CARER_PASSWORD S2_T75_EXECUTE
}
trap cleanup EXIT INT TERM HUP

[[ "$PWD" == "$ROOT" ]] || { printf 'STOP_S2_T75_WRONG_WORKTREE\n' >&2; exit 1; }

if [[ "$ACTION" == "preflight" ]]; then
  node scripts/s2-care-circle-two-account-operator.mjs --project-ref "$PROJECT_REF"
  exit 0
fi

[[ "$ACTION" == "setup" || "$ACTION" == "cleanup" ]] || { printf 'STOP_S2_T75_ACTION_INVALID\n' >&2; exit 1; }
[[ "$RUN_ID" =~ ^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$ ]] || { printf 'STOP_S2_T75_RUN_ID_INVALID\n' >&2; exit 1; }

read_hidden() {
  local prompt="$1" variable="$2" value
  printf '%s' "$prompt" >/dev/tty
  TTY_STATE="$(stty -g </dev/tty)"
  stty -echo </dev/tty
  IFS= read -r value </dev/tty
  stty "$TTY_STATE" </dev/tty
  TTY_STATE=""
  printf '\n' >/dev/tty
  printf -v "$variable" '%s' "$value"
}

read_hidden 'Paste the dedicated staging sb_secret_ QA key (hidden): ' S2_T75_SECRET_KEY
export S2_T75_SECRET_KEY S2_T75_EXECUTE=CONFIRMED

if [[ "$ACTION" == "setup" ]]; then
  read_hidden "Enter exactly lumis.s2t75.caree.${RUN_ID}@example.com (hidden): " S2_T75_CAREE_EMAIL
  read_hidden 'Enter a new Caree test password of at least 20 characters (hidden): ' S2_T75_CAREE_PASSWORD
  read_hidden "Enter exactly lumis.s2t75.carer.${RUN_ID}@example.com (hidden): " S2_T75_CARER_EMAIL
  read_hidden 'Enter a different Carer test password of at least 20 characters (hidden): ' S2_T75_CARER_PASSWORD
  export S2_T75_CAREE_EMAIL S2_T75_CAREE_PASSWORD S2_T75_CARER_EMAIL S2_T75_CARER_PASSWORD
fi

node scripts/s2-care-circle-two-account-operator.mjs \
  --execute --action "$ACTION" --project-ref "$PROJECT_REF" --run-id "$RUN_ID"

printf 'temporary_credentials_unset=on_exit\n'
printf 'dedicated_qa_key_revocation=required_after_cleanup\n'
