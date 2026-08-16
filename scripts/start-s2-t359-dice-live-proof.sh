#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
MODE="${1:-preflight}"
MANIFEST="${LUMIS_T359_INTEGRATION_MANIFEST:?Set LUMIS_T359_INTEGRATION_MANIFEST to the reviewed external manifest.}"

stop() { printf 'STOP_S2_T359_%s\n' "$1" >&2; exit 1; }
case "$ROOT" in /Volumes/LumisDevSSD/Development/Worktrees/*) ;; *) stop SSD_WORKTREE_REQUIRED ;; esac
node "$SCRIPT_DIR/s2-t359-dice-live-proof.mjs" preflight "$MANIFEST"

WEB_LAUNCHER="$(node -e 'const x=require(process.argv[1]);process.stdout.write(x.web_launcher)' "$MANIFEST")"
MOBILE_LAUNCHER="$(node -e 'const x=require(process.argv[1]);process.stdout.write(x.mobile_launcher)' "$MANIFEST")"

case "$MODE" in
  preflight) ;;
  web) exec bash "$ROOT/$WEB_LAUNCHER" ;;
  mobile) exec bash "$ROOT/$MOBILE_LAUNCHER" --lan ;;
  verify)
    RECEIPT="${LUMIS_T359_PROOF_RECEIPT:?Set LUMIS_T359_PROOF_RECEIPT to the metadata-only proof receipt.}"
    exec node "$SCRIPT_DIR/s2-t359-dice-live-proof.mjs" verify "$MANIFEST" "$RECEIPT"
    ;;
  *) stop MODE_INVALID ;;
esac
