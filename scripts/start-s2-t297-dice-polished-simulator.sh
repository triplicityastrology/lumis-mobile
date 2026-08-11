#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_POLISHED_SIMULATOR_PORT:-8172}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T297_SIMULATOR_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" == "8172" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t297-dice-polished-e2e" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
HEAD="$(git rev-parse HEAD)"
RUNTIME_TMP="$ROOT/.tmp/s2-t297-metro-$PORT"
rm -rf "$RUNTIME_TMP"
mkdir -p "$RUNTIME_TMP"
trap 'rm -rf "$RUNTIME_TMP"' EXIT INT TERM
printf 'S2_T297_SIMULATOR_READY source_sha=%s port=8172 mode=dev_prelogin provider_calls=0 units=0 persistence=0\n' "$HEAD"
TMPDIR="$RUNTIME_TMP" EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E=1 EXPO_PUBLIC_FOUNDER_DICE_E2E_HEAD="$HEAD" \
  exec pnpm --dir apps/mobile exec expo start --ios --clear --port "$PORT"
