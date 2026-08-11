#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_V4_EXPO_PORT:-8159}"
stop() { printf 'STOP_S2_T290_EXPO_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" == "8159" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t290-founder-dice-v4" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
printf 'S2_T290_FOUNDER_DICE_EXPO_READY\nsource_sha=%s\nstate=founder-dice-v4\nmode=LAN\nprovider_calls=0 units=0 persistence=0\nphone=Open Expo Go, scan this terminal QR, confirm the full BUILD marker.\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-dice-v4" \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
