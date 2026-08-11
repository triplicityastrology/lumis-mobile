#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_QUESTION_BANK_WEB_PORT:-8163}"
stop() { printf 'STOP_S2_T295_WEB_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" == "8163" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t295-founder-question-bank" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
EXPORT_ROOT="$ROOT/.tmp/s2-t295-founder-question-bank-web-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/s2-t295-founder-question-bank-web-8163") ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
cleanup() { rm -rf "$EXPORT_ROOT"; }
trap cleanup EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-question-bank" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "21 supplied; select exactly one to exclude" "$JS_ROOT" >/dev/null || stop QUESTION_BANK_ROUTE_MISSING
grep -RFl -- "Runtime accepts fixture_id only" "$JS_ROOT" >/dev/null || stop RUNTIME_BOUNDARY_MISSING
printf 'S2_T295_WEB_READY source_sha=%s open=http://localhost:8163 provider_calls=0 units=0 persistence=0\n' "$HEAD"
exec python3 -m http.server 8163 --bind 127.0.0.1 --directory "$EXPORT_ROOT"
