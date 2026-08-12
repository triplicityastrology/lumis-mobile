#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T321_WEB_PORT:-8194}"
stop() { printf 'STOP_S2_T321_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t321-chat-post-dice-rc" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 8192 && PORT <= 65534 )) || stop PORT_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
EXPORT_ROOT="$ROOT/.tmp/s2-t321-founder-chat-$PORT"
rm -rf "$EXPORT_ROOT"
trap 'rm -rf "$EXPORT_ROOT"' EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1 EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_POLISHED_CHAT_STATE="t321-post-dice-offline" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "S2_T299_POLISHED_CHAT_ROUTE" "$JS_ROOT" >/dev/null || stop ROUTE_MARKER_MISSING
grep -RFl -- "Founder Talk preview" "$JS_ROOT" >/dev/null || stop OFFLINE_MARKER_MISSING
printf 'S2_T321_FOUNDER_CHAT_WEB_READY source_sha=%s route=polished-talk-prelogin open=http://localhost:%s\n' "$HEAD" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
