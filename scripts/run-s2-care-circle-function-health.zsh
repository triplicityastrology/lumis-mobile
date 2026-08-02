#!/bin/zsh

set -euo pipefail

readonly ROOT="/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
readonly PROJECT_REF="bmqhwofmdgebpcihjlnb"
MODE="preflight"
DEPLOYED_VERSION=""
DEPLOYED_SHA256=""
TTY_STATE=""

while (( $# > 0 )); do
  case "$1" in
    --) shift ;;
    --execute) MODE="execute"; shift ;;
    --deployed-version) DEPLOYED_VERSION="${2:-}"; shift 2 ;;
    --deployed-sha256) DEPLOYED_SHA256="${2:-}"; shift 2 ;;
    *) print -u2 -- "STOP_S2_T104_ARGUMENTS_INVALID"; exit 1 ;;
  esac
done

cleanup() {
  if [[ -n "$TTY_STATE" ]]; then stty "$TTY_STATE" </dev/tty 2>/dev/null || true; fi
  unset S2_T104_DISPOSABLE_ACCESS_TOKEN
}
trap cleanup EXIT HUP INT TERM

cd "$ROOT"
node scripts/s2-care-circle-four-digit-seal.mjs --check >/dev/null
if [[ "$MODE" != "execute" ]]; then
  node scripts/s2-care-circle-function-health.mjs --project-ref "$PROJECT_REF"
  exit 0
fi

print -rn -- "Paste a disposable staging user access token (hidden): " >/dev/tty
TTY_STATE="$(stty -g </dev/tty)"
stty -echo </dev/tty
IFS= read -r S2_T104_DISPOSABLE_ACCESS_TOKEN </dev/tty
stty "$TTY_STATE" </dev/tty
TTY_STATE=""
print >/dev/tty
export S2_T104_DISPOSABLE_ACCESS_TOKEN

node scripts/s2-care-circle-function-health.mjs \
  --execute --project-ref "$PROJECT_REF" \
  --deployed-version "$DEPLOYED_VERSION" \
  --deployed-sha256 "$DEPLOYED_SHA256"
