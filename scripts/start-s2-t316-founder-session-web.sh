#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${FOUNDER_T316_WEB_PORT:-8187}"
stop() { printf 'STOP_S2_T316_WEB_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
[[ "$(git branch --show-current)" == "codex/s2-t316-founder-dice-chat-session" ]] || stop WRONG_BRANCH
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
HEAD="$(git rev-parse HEAD)"
OUT="$ROOT/.tmp/s2-t316-web-$PORT"
rm -rf "$OUT"
EXPO_PUBLIC_FOUNDER_TOMORROW_SESSION=1 EXPO_PUBLIC_FOUNDER_T316_HEAD="$HEAD" \
  EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_KEY= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
  pnpm --dir apps/mobile exec expo export --dev --platform web --output-dir "$OUT"
printf 'S2_T316_WEB_READY source_sha=%s port=%s route=founder_tomorrow_session\n' "$HEAD" "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$OUT"
