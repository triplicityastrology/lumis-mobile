#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_QUESTION_BANK_EXPO_PORT:-8165}"
stop() { printf 'STOP_S2_T295_EXPO_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" == "8165" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t295-founder-question-bank" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T295_EXPO_READY source_sha=%s port=8165 mode=LAN runtime=unavailable provider_calls=0\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-question-bank" \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
