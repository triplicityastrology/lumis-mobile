#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${FOUNDER_DICE_REGISTRY_SIM_PORT:-8131}"
DEVICE="${FOUNDER_DICE_REGISTRY_DEVICE:-booted}"
HEAD="$(git -C "$ROOT" rev-parse HEAD)"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "STOP_S2_T248_PORT_OCCUPIED"
  exit 1
fi
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || { echo "STOP_S2_T248_TRACKED_TREE_DIRTY"; exit 1; }
xcrun simctl list devices booted | grep -q "Booted" || { echo "STOP_S2_T248_SIMULATOR_NOT_BOOTED"; exit 1; }

(
  for _ in {1..60}; do
    if curl -fsS "http://127.0.0.1:$PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
      xcrun simctl openurl "$DEVICE" "exp://127.0.0.1:$PORT"
      exit 0
    fi
    sleep 1
  done
  echo "STOP_S2_T248_METRO_NOT_READY"
) &

echo "S2_T248_DICE_REGISTRY_SIMULATOR_STARTING"
echo "BUILD=$HEAD"
cd "$ROOT/apps/mobile"
EXPO_PUBLIC_DICE_FIXTURE_REGISTRY=1 \
EXPO_PUBLIC_DICE_FIXTURE_REGISTRY_HEAD="$HEAD" \
exec ./node_modules/.bin/expo start --clear --localhost --port "$PORT"
