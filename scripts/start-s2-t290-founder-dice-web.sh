#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_V4_WEB_PORT:-8157}"
EXPECTED_BRANCH="codex/s2-t290-founder-dice-v4"
stop() { printf 'STOP_S2_T290_WEB_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" == "8157" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "$EXPECTED_BRANCH" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$PID" ]]; then
  OWNER_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
  [[ "$OWNER_CWD" == "$ROOT" || "$OWNER_CWD" == "$ROOT/apps/mobile" ]] && stop STALE_SAME_PROJECT_SERVER
  stop PORT_OWNED_BY_ANOTHER_PROJECT
fi

EXPORT_ROOT="$ROOT/.tmp/s2-t290-founder-dice-web-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/s2-t290-founder-dice-web-8157") ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
cleanup() { rm -rf "$EXPORT_ROOT"; }
trap cleanup EXIT INT TERM

printf 'S2_T290_FOUNDER_DICE_WEB_READY\nsource_sha=%s\nroute=founder-dice-v4\nfixtures=40 en=20 zh_hant=20\nprovider_calls=0 units=0 persistence=0\nopen=http://localhost:8157\n' "$HEAD"
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-dice-v4" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Accepted v4 deployment gate" "$JS_ROOT" >/dev/null || stop V4_ROUTE_MISSING
grep -RFl -- "CURRENT NEXT ACTION" "$JS_ROOT" >/dev/null || stop NEXT_ACTION_MISSING
grep -RFl -- "Download rating sheet" "$JS_ROOT" >/dev/null || stop DOWNLOAD_MISSING
printf 'S2_T290_EXACT_EXPORT_VERIFIED source_sha=%s port=8157\nKeep this terminal open; press Ctrl+C to stop.\n' "$HEAD"
exec python3 -m http.server 8157 --bind 127.0.0.1 --directory "$EXPORT_ROOT"
