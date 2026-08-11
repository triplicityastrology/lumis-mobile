#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_INTAKE_SIMULATOR_PORT:-8154}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T285_SIMULATOR_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" == "8154" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t285-founder-dice-intake" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
xcrun simctl listapps "$DEVICE" | grep -Fq 'host.exp.Exponent' || stop EXPO_GO_NOT_INSTALLED
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
xcrun simctl terminate "$DEVICE" host.exp.Exponent >/dev/null 2>&1 || true
printf 'S2_T285_FOUNDER_DICE_INTAKE_SIMULATOR_READY source_sha=%s state=founder-dice-intake provider_calls=0 units=0 persistence=0 port=8154\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-dice-intake" \
  exec pnpm --dir apps/mobile exec expo start --ios --clear --port "$PORT"
