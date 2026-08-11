#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8155}"
if (( PORT >= 8124 && PORT <= 8125 )) || (( PORT >= 8140 && PORT <= 8154 )); then
  echo "STOP_S2_T289_PROTECTED_PORT"
  exit 2
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "STOP_S2_T289_PORT_OCCUPIED:$PORT"
  exit 2
fi
HEAD="$(git -C "$ROOT" rev-parse HEAD)"
test -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" || { echo "STOP_S2_T289_DIRTY_TRACKED_TREE"; exit 2; }
rm -rf "$ROOT/.tmp/s2-t289-web"
cd "$ROOT/apps/mobile"
EXPO_PUBLIC_DICE_V4_TECHNICAL_EVIDENCE=1 EXPO_PUBLIC_DICE_TECHNICAL_EVIDENCE_HEAD="$HEAD" \
  "$ROOT/apps/mobile/node_modules/.bin/expo" export --platform web --dev --output-dir "$ROOT/.tmp/s2-t289-web"
cd "$ROOT"
grep -R -q "Dice Technical evidence" "$ROOT/.tmp/s2-t289-web" || { echo "STOP_S2_T289_WRONG_ROUTE"; exit 2; }
echo "S2_T289_FOUNDER_DASHBOARD http://localhost:$PORT BUILD=$HEAD LOCAL_REHEARSAL_ONLY"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/.tmp/s2-t289-web"
