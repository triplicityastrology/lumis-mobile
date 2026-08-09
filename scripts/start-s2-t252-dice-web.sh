#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_T252_WEB_PORT:-8136}"
STATE="${FOUNDER_DICE_T252_STATE:-question_validation}"
stop() { printf 'STOP_S2_T252_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t252-dice-ai-rc" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
HEAD="$(git rev-parse HEAD)"
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
EXPORT_ROOT="$ROOT/.tmp/founder-dice-t252-$PORT"
rm -rf "$EXPORT_ROOT"
trap 'rm -rf "$EXPORT_ROOT"' EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY=1 EXPO_PUBLIC_DICE_GALLERY_HEAD="$HEAD" EXPO_PUBLIC_DICE_CAPTURE_STATE="$STATE" \
  pnpm --dir apps/mobile exec expo export --dev --platform web --clear --output-dir "$EXPORT_ROOT"
BUNDLE="$(find "$EXPORT_ROOT/_expo/static/js/web" -type f -name '*.js' -print -quit)"
[[ -n "$BUNDLE" ]] || stop BUNDLE_MISSING
rg -Fq "$HEAD" "$BUNDLE" || stop BUILD_MARKER_MISMATCH
rg -Fq 'dice-zero-effects-boundary' "$BUNDLE" || stop ZERO_EFFECTS_MARKER_MISSING
printf 'S2_T252_DICE_WEB_READY\nsource_sha=%s\nstate=%s\nopen=http://localhost:%s\n' "$HEAD" "$STATE" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
