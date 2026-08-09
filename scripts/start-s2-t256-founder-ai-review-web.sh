#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_AI_REVIEW_WEB_PORT:-8138}"
EXPECTED_BRANCH="codex/s2-t256-founder-ai-e2e-console"
stop() { printf 'STOP_S2_T256_WEB_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
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

EXPORT_ROOT="$ROOT/.tmp/s2-t256-founder-ai-review-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/s2-t256-founder-ai-review-"*) ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
cleanup() { rm -rf "$EXPORT_ROOT"; }
trap cleanup EXIT INT TERM

printf 'S2_T256_FOUNDER_AI_E2E_WEB_READY\nsource_sha=%s\nstate=dice-founder-intake\nroute=founder-ai-e2e-review\nmode=local_closed_synthetic\nopen=http://localhost:%s\n' "$HEAD" "$PORT"
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="dice-founder-intake" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Prepare Founder questions" "$JS_ROOT" >/dev/null || stop ROUTE_MARKER_MISSING
grep -RFl -- "Synthetic evidence only" "$JS_ROOT" >/dev/null || stop SAFETY_MARKER_MISSING
grep -RFl -- "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" "$JS_ROOT" >/dev/null || stop CHAT_GATE_MARKER_MISSING
printf 'S2_T256_EXPORT_VERIFIED source_sha=%s state=dice-founder-intake\nKeep this terminal open; press Ctrl+C to stop.\n' "$HEAD"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
