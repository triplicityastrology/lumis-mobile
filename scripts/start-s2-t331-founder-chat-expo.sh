#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T331_EXPO_PORT:-8198}"
stop() { printf 'STOP_S2_T331_EXPO_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t331-final-chat-after-dice-root" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || stop INVALID_PORT
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T331_FOUNDER_CHAT_EXPO_READY source_sha=%s route=polished-talk-prelogin port=%s mode=offline-fixture live_authority=false\n' "$HEAD" "$PORT"
EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_STATE="t331-chat-after-dice-disabled" \
  EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
