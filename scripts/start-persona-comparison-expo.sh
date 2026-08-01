#!/usr/bin/env bash
# Development-only normal Expo entry for the local persona comparison fixture.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MOBILE_DIR="$ROOT/apps/mobile"
PORT="${LUMIS_EXPO_PORT:-8082}"

case "$PORT" in 8081|8082) ;; *) printf 'STOP: LUMIS_EXPO_PORT must be 8081 or 8082.\n' >&2; exit 1 ;; esac
for command_name in lsof pnpm git; do
  command -v "$command_name" >/dev/null 2>&1 || { printf 'STOP: %s is required.\n' "$command_name" >&2; exit 1; }
done

GIT_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[[ "$GIT_ROOT" == "$ROOT" ]] || { printf 'STOP: unexpected Lumis worktree.\n' >&2; exit 1; }
COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null || true)"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { printf 'STOP: source revision is unavailable.\n' >&2; exit 1; }
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || { printf 'STOP: tracked source changes are uncommitted.\n' >&2; exit 1; }

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
  PID="${PIDS%%$'\n'*}"
  PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
  printf 'STOP: port %s is occupied by PID %s (cwd: %s). It was not stopped.\n' "$PORT" "$PID" "${PROCESS_CWD:-unavailable}" >&2
  exit 1
fi

printf 'LUMIS_PERSONA_COMPARISON commit=%s app=normal-expo fixture_only=true\n' "$COMMIT"
printf 'Keep this Terminal open; press Ctrl+C here when finished.\n'
cd "$ROOT"
export EXPO_PUBLIC_PERSONA_COMPARISON_WORKBENCH=1
exec pnpm --dir "$MOBILE_DIR" exec expo start --tunnel --port "$PORT" --clear
