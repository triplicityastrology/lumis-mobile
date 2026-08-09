#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_GALLERY_PORT:-8116}"
EXPECTED_BRANCH="codex/s2-t243-dice-interactive-offline"
stop() { printf 'STOP_S2_T243_GALLERY_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
cd "$ROOT"
[[ "$(git branch --show-current)" == "$EXPECTED_BRANCH" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$PID" ]]; then
  OWNER_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  [[ "$OWNER_CWD" == "$ROOT" || "$OWNER_CWD" == "$ROOT/apps/mobile" ]] && stop STALE_SAME_PROJECT_SERVER
  stop PORT_OWNED_BY_ANOTHER_PROJECT
fi
EXPORT_ROOT="$ROOT/.tmp/founder-dice-t243-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/founder-dice-t243-"*) ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
cleanup() { rm -rf "$EXPORT_ROOT"; }
trap cleanup EXIT INT TERM
EXPO_OFFLINE=1 EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY=1 EXPO_PUBLIC_DICE_GALLERY_HEAD="$HEAD" EXPO_PUBLIC_DICE_CAPTURE_STATE="invalid_hi" \
  pnpm --dir apps/mobile exec expo export --dev --platform web --clear --output-dir "$EXPORT_ROOT"
BUNDLE="$(find "$EXPORT_ROOT/_expo/static/js/web" -type f -name '*.js' -print -quit)"
[[ -n "$BUNDLE" ]] || stop EXPORT_BUNDLE_MISSING
rg -Fq "$HEAD" "$BUNDLE" || stop EXPORTED_BUILD_MARKER_MISMATCH
rg -Fq 'dice-capture-evidence-strip' "$BUNDLE" || stop GALLERY_MARKER_MISSING
rg -Fq 'STATE ' "$BUNDLE" || stop NORMAL_AUTH_FALLBACK
rg -Fq 'dice-zero-effects-boundary' "$BUNDLE" || stop ZERO_EFFECT_BOUNDARY_MISSING
printf 'S2_T243_DICE_GALLERY_READY\nsource_sha=%s\nmode=local_synthetic_no_persistence_no_units_no_live_ai\nopen=http://localhost:%s\n' "$HEAD" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$EXPORT_ROOT"
