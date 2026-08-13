#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T336_SIMULATOR_PORT:-8200}"
stop() { printf 'STOP_S2_T336_SIMULATOR_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t336-chat-after-dice-ssd" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || stop INVALID_PORT
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T336_FOUNDER_CHAT_SIMULATOR_READY source_sha=%s route=polished-talk-prelogin port=%s mode=offline-fixture live_authority=false\n' "$HEAD" "$PORT"
EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_STATE="t336-chat-after-dice-product-disabled" \
  EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  exec pnpm --dir apps/mobile exec expo start --localhost --clear --port "$PORT"
