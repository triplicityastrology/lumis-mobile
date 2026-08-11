#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8160}"
if (( PORT == 8124 || PORT == 8125 || (PORT >= 8140 && PORT <= 8159) )); then
  echo "STOP_S2_T294_PROTECTED_PORT"
  exit 2
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "STOP_S2_T294_PORT_OCCUPIED:$PORT"
  exit 2
fi
HEAD="$(git -C "$ROOT" rev-parse HEAD)"
test -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" || { echo "STOP_S2_T294_DIRTY_TRACKED_TREE"; exit 2; }
rm -rf "$ROOT/.tmp/s2-t294-web"
cd "$ROOT/apps/mobile"
EXPO_PUBLIC_DICE_T294_CONTROL_ROOM=1 EXPO_PUBLIC_DICE_T294_CONTROL_ROOM_HEAD="$HEAD" \
  "$ROOT/apps/mobile/node_modules/.bin/expo" export --platform web --dev --output-dir "$ROOT/.tmp/s2-t294-web"
cd "$ROOT"
grep -R -q "Dice Technical run control room" "$ROOT/.tmp/s2-t294-web" || { echo "STOP_S2_T294_WRONG_ROUTE"; exit 2; }
grep -R -q "$HEAD" "$ROOT/.tmp/s2-t294-web" || { echo "STOP_S2_T294_WRONG_BUILD"; exit 2; }
echo "S2_T294_CONTROL_ROOM http://localhost:$PORT BUILD=$HEAD LOCAL_REHEARSAL_ONLY"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/.tmp/s2-t294-web"
