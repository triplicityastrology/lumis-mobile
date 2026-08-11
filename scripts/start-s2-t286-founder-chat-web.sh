#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T286_WEB_PORT:-8153}"
stop() { printf 'STOP_S2_T286_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t286-chat-deploy-test-final" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
EXPORT_ROOT="$ROOT/.tmp/s2-t286-founder-chat-$PORT"
rm -rf "$EXPORT_ROOT"
trap 'rm -rf "$EXPORT_ROOT"' EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_COMPANION_CHAT=1 EXPO_PUBLIC_FOUNDER_COMPANION_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_COMPANION_STATE="t286-chat-prelogin" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Founder test window" "$JS_ROOT" >/dev/null || stop ROUTE_MARKER_MISSING
grep -RFl -- "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" "$JS_ROOT" >/dev/null || stop AUTHORITY_MARKER_MISSING
printf 'S2_T286_FOUNDER_CHAT_WEB_READY source_sha=%s route=founder-companion-chat-window open=http://localhost:%s\n' "$HEAD" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
