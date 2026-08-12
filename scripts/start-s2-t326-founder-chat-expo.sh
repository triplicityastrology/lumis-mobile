#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T326_EXPO_PORT:-8196}"
stop() { printf 'STOP_S2_T326_EXPO_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t326-chat-product-path" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 8196 && PORT <= 65534 )) || stop PORT_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T326_FOUNDER_CHAT_EXPO_READY source_sha=%s route=polished-talk-prelogin port=%s mode=offline-fixture live_authority=false\n' "$HEAD" "$PORT"
EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_STATE="t326-product-path-offline" \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
