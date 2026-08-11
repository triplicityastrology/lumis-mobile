#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_WINDOW_SIMULATOR_PORT:-8152}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
stop() { printf 'STOP_S2_T281_SIMULATOR_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t281-chat-final-request" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
xcrun simctl listapps "$DEVICE" | grep -Fq 'host.exp.Exponent' || stop EXPO_GO_NOT_INSTALLED
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
printf 'S2_T281_FOUNDER_CHAT_WINDOW_SIMULATOR_READY source_sha=%s route=founder-companion-chat-window mode=local_closed_synthetic\n' "$HEAD"
EXPO_PUBLIC_FOUNDER_COMPANION_CHAT=1 EXPO_PUBLIC_FOUNDER_COMPANION_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_COMPANION_STATE="founder-chat-window-prelogin" \
  exec pnpm --dir apps/mobile exec expo start --ios --clear --port "$PORT"
