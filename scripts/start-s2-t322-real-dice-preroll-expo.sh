#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_T322_EXPO_PORT:-8195}"
stop() { printf 'STOP_S2_T322_EXPO_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t322-real-dice-preroll-validation" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || stop INVALID_PORT
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T322_REAL_DICE_PREROLL_READY source_sha=%s port=%s validation=before_roll provider_calls=0 persistence=0 units=0\n' "$HEAD" "$PORT"
EXPO_PUBLIC_FOUNDER_TOMORROW_SESSION=1 EXPO_PUBLIC_FOUNDER_T316_HEAD="$HEAD" \
  EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
