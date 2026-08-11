#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_QUESTION_BANK_SIMULATOR_PORT:-8164}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T295_SIMULATOR_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" == "8164" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t295-founder-question-bank" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T295_SIMULATOR_READY source_sha=%s port=8164 runtime=unavailable provider_calls=0\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-question-bank" \
  exec pnpm --dir apps/mobile exec expo start --ios --clear --port "$PORT"
