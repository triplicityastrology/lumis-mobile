#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_DICE_POLISHED_WEB_PORT:-8171}"
stop() { printf 'STOP_S2_T297_WEB_%s\n' "$1" >&2; exit 1; }
[[ "$PORT" == "8171" ]] || stop DEDICATED_PORT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t297-dice-polished-e2e" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
EXPORT_ROOT="$ROOT/.tmp/s2-t297-dice-polished-web-$PORT"
RUNTIME_TMP="$ROOT/.tmp/s2-t297-metro-$PORT"
case "$EXPORT_ROOT" in "$ROOT/.tmp/s2-t297-dice-polished-web-8171") ;; *) stop EXPORT_PATH_UNSAFE ;; esac
rm -rf "$EXPORT_ROOT"
rm -rf "$RUNTIME_TMP"
mkdir -p "$RUNTIME_TMP"
cleanup() { rm -rf "$EXPORT_ROOT" "$RUNTIME_TMP"; }
trap cleanup EXIT INT TERM
TMPDIR="$RUNTIME_TMP" EXPO_OFFLINE=1 EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E=1 EXPO_PUBLIC_FOUNDER_DICE_E2E_HEAD="$HEAD" \
  pnpm --dir apps/mobile exec expo export --platform web --dev --clear --output-dir "$EXPORT_ROOT"
JS_ROOT="$EXPORT_ROOT/_expo/static/js/web"
grep -RFl -- "$HEAD" "$JS_ROOT" >/dev/null || stop BUILD_MARKER_MISSING
grep -RFl -- "Founder Dice evidence controls outside the product screen" "$JS_ROOT" >/dev/null || stop EXTERNAL_EVIDENCE_BOUNDARY_MISSING
grep -RFl -- "Astrology Dice" "$JS_ROOT" >/dev/null || stop PRODUCT_ROUTE_MISSING
printf 'S2_T297_WEB_READY source_sha=%s open=http://localhost:8171 mode=dev_prelogin provider_calls=0 units=0 persistence=0\n' "$HEAD"
exec python3 -m http.server 8171 --bind 127.0.0.1 --directory "$EXPORT_ROOT"
