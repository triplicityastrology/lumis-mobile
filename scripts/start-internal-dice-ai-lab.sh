#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${LUMIS_INTERNAL_DICE_LAB_PORT:-8147}"
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || { echo "STOP_LAB_PORT_INVALID" >&2; exit 1; }
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t356-web-dice-free-text" ]] || { echo "STOP_LAB_WRONG_BRANCH" >&2; exit 1; }
exec env LUMIS_INTERNAL_DICE_LAB_PORT="$PORT" node "$ROOT/tools/internal-dice-ai-lab/server.mjs"
