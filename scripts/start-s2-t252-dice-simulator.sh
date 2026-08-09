#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_T252_SIMULATOR_PORT:-8137}"
STATE="${FOUNDER_DICE_T252_STATE:-question_validation}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T252_SIMULATOR_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t252-dice-ai-rc" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
HEAD="$(git rev-parse HEAD)"
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
ROUTE="exp://127.0.0.1:${PORT}/--/founder-dice-t252?state=${STATE}"
(
  for _ in {1..60}; do
    if curl --fail --silent --max-time 2 "http://127.0.0.1:${PORT}/status" | grep -Fq 'packager-status:running'; then
      xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null
      exit 0
    fi
    sleep 1
  done
  printf 'STOP_S2_T252_SIMULATOR_METRO_TIMEOUT\n' >&2
) &
printf 'S2_T252_DICE_SIMULATOR_START source_sha=%s state=%s port=%s\n' "$HEAD" "$STATE" "$PORT"
EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY=1 EXPO_PUBLIC_DICE_GALLERY_HEAD="$HEAD" EXPO_PUBLIC_DICE_CAPTURE_STATE="$STATE" \
  exec pnpm --dir apps/mobile exec expo start --clear --port "$PORT"
