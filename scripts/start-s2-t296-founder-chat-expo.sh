#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T296_EXPO_PORT:-8170}"
stop() { printf 'STOP_S2_T296_EXPO_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t296-chat-operational-packet" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 8160 && PORT <= 65534 )) || stop PORT_PROTECTED_OR_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
printf 'S2_T296_FOUNDER_CHAT_EXPO_READY source_sha=%s route=founder-chat-operational port=%s mode=local-only\n' "$HEAD" "$PORT"
EXPO_PUBLIC_FOUNDER_COMPANION_CHAT=1 EXPO_PUBLIC_FOUNDER_COMPANION_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_COMPANION_STATE="t296-chat-operational-prelogin" \
  exec pnpm --dir apps/mobile exec expo start --lan --clear --port "$PORT"
