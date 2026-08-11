#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_WEB_PORT:-8141}"
EXPECTED_BRANCH="codex/s2-t264-founder-dice-e2e"
stop() { printf 'STOP_S2_T264_WEB_%s\n' "$1" >&2; exit 1; }

[[ "$PORT" == "8141" ]] || stop DEDICATED_PORT_REQUIRED
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

EXPORT_ROOT="$ROOT/.tmp/s2-t264-founder-dice-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/s2-t264-founder-dice-8141") ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
cleanup() { rm -rf "$EXPORT_ROOT"; }
trap cleanup EXIT INT TERM

printf 'S2_T264_FOUNDER_DICE_WEB_READY\nsource_sha=%s\nstate=not_yet_run_or_offline_preview\nroute=founder-dice-e2e\ngateway=disabled_without_accepted_envelope\nopen=http://localhost:8141\n' "$HEAD"
EXPO_OFFLINE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE=1 EXPO_PUBLIC_FOUNDER_AI_REVIEW_HEAD="$HEAD" EXPO_PUBLIC_FOUNDER_AI_REVIEW_STATE="founder-dice-e2e" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
[[ -d "$JS_ROOT" ]] || stop EXPORT_JS_MISSING
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Freeze selected slot" "$JS_ROOT" >/dev/null || stop SELECT_FREEZE_MARKER_MISSING
grep -RFl -- "Eligibility and invoke seam" "$JS_ROOT" >/dev/null || stop ELIGIBILITY_MARKER_MISSING
grep -RFl -- "STOP_S2_T264_GATEWAY_DISABLED" "$JS_ROOT" >/dev/null || stop DISABLED_GATE_MARKER_MISSING
grep -RFl -- "Prepare checksum package" "$JS_ROOT" >/dev/null || stop VERDICT_MARKER_MISSING
printf 'S2_T264_EXACT_EXPORT_VERIFIED source_sha=%s port=8141\nKeep this terminal open; press Ctrl+C to stop.\n' "$HEAD"
exec python3 -m http.server 8141 --bind 127.0.0.1 --directory "$EXPORT_ROOT"
