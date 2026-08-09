#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${FOUNDER_DICE_REGISTRY_PORT:-8130}"
HEAD="$(git -C "$ROOT" rev-parse HEAD)"
OUT="$ROOT/.tmp/s2-t248-web"

[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || { echo "STOP_S2_T248_INVALID_PORT"; exit 1; }
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "STOP_S2_T248_PORT_OCCUPIED"
  exit 1
fi
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || { echo "STOP_S2_T248_TRACKED_TREE_DIRTY"; exit 1; }

rm -rf "$OUT"
(
  cd "$ROOT/apps/mobile"
  EXPO_PUBLIC_DICE_FIXTURE_REGISTRY=1 \
  EXPO_PUBLIC_DICE_FIXTURE_REGISTRY_HEAD="$HEAD" \
  CI=1 ./node_modules/.bin/expo export --dev --platform web --output-dir "$OUT"
)
grep -R -q "Dice Founder fixture preparation" "$OUT" || { echo "STOP_S2_T248_GALLERY_ROUTE_MISSING"; exit 1; }
grep -R -q "$HEAD" "$OUT" || { echo "STOP_S2_T248_BUILD_MARKER_MISSING"; exit 1; }
echo "S2_T248_DICE_REGISTRY_WEB_READY"
echo "BUILD=$HEAD"
echo "URL=http://localhost:$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$OUT"
