#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_CHAT_T296_WEB_PORT:-8168}"
stop() { printf 'STOP_S2_T296_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t296-chat-operational-packet" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 8160 && PORT <= 65534 )) || stop PORT_PROTECTED_OR_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
HEAD="$(git rev-parse HEAD)"
EXPORT_ROOT="$ROOT/.tmp/s2-t296-founder-chat-$PORT"
rm -rf "$EXPORT_ROOT"
trap 'rm -rf "$EXPORT_ROOT"' EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_COMPANION_CHAT=1 EXPO_PUBLIC_FOUNDER_COMPANION_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_COMPANION_STATE="t296-chat-operational-prelogin" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Founder Chat review" "$JS_ROOT" >/dev/null || stop ROUTE_MARKER_MISSING
grep -RFl -- "s2_t289_dice_technical_evidence_package_v1" "$JS_ROOT" >/dev/null || stop DICE_T289_MARKER_MISSING
grep -RFl -- "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" "$JS_ROOT" >/dev/null || stop AUTHORITY_MARKER_MISSING
printf 'S2_T296_FOUNDER_CHAT_WEB_READY source_sha=%s route=founder-chat-operational open=http://localhost:%s\n' "$HEAD" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
