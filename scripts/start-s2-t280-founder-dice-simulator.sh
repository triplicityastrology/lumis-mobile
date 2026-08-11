#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_WINDOW_SIMULATOR_PORT:-8148}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T280_SIMULATOR_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" == "8148" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t280-founder-dice-window-final" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
xcrun simctl listapps "$DEVICE" | grep -Fq 'host.exp.Exponent' || stop EXPO_GO_NOT_INSTALLED
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
# Expo Go can remain visibly attached to an older Metro bundle after a source
# restart. Close only the named Simulator app so `expo start --ios` must load
# this launcher's exact HEAD; no host process or other Simulator is touched.
xcrun simctl terminate "$DEVICE" host.exp.Exponent >/dev/null 2>&1 || true
printf 'S2_T280_FOUNDER_DICE_SIMULATOR_READY source_sha=%s state=not_yet_run_or_offline_preview provider_calls=0 port=8148\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-dice-window-final" \
  exec pnpm --dir apps/mobile exec expo start --ios --clear --port "$PORT"
