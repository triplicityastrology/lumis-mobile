#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T326_WEB_PORT:-8197}"
stop() { printf 'STOP_S2_T326_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t326-chat-product-path" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
OUT="$ROOT/.tmp/s2-t326-web"
rm -rf "$OUT"
EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_STATE="t326-product-path-offline" \
  pnpm --dir apps/mobile exec expo export --dev --platform web --output-dir "$OUT"
printf 'S2_T326_FOUNDER_CHAT_WEB_READY source_sha=%s url=http://localhost:%s mode=offline-fixture live_authority=false\n' "$HEAD" "$PORT"
exec pnpm dlx serve "$OUT" -l "$PORT"
