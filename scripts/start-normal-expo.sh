#!/usr/bin/env bash
# Founder normal-app launcher. This deliberately never selects a test workbench.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MOBILE_DIR="$ROOT/apps/mobile"
PORT="${LUMIS_EXPO_PORT:-8081}"

case "$PORT" in
  8081|8082) ;;
  *)
    printf 'STOP: LUMIS_EXPO_PORT must be 8081 or 8082.\n' >&2
    exit 1
    ;;
esac

if ! command -v lsof >/dev/null 2>&1; then
  printf 'STOP: lsof is required to verify the Expo port safely.\n' >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf 'STOP: pnpm is unavailable on PATH.\n' >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  printf 'STOP: git is required to identify the current Lumis build.\n' >&2
  exit 1
fi

GIT_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ "$GIT_ROOT" != "$ROOT" ]]; then
  printf 'STOP: launcher is not inside the expected Lumis worktree.\n' >&2
  exit 1
fi

COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null || true)"
BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
if [[ ! "$COMMIT" =~ ^[0-9a-f]{40}$ || -z "$BRANCH" ]]; then
  printf 'STOP: current Lumis source revision could not be verified.\n' >&2
  exit 1
fi

if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
  printf 'STOP: tracked source changes are uncommitted. Commit or review them before Founder capture.\n' >&2
  exit 1
fi

# `lsof` returns 1 when nothing listens.  Treat that expected result as empty;
# never combine it with `set -e` in a pipeline that would terminate the launcher.
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"

if [[ -n "$PIDS" ]]; then
  while IFS= read -r PID; do
    [[ -z "$PID" ]] && continue
    PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"

    case "$PROCESS_CWD" in
      "$ROOT"|"$MOBILE_DIR")
        printf 'STOP: port %s is already serving this Lumis worktree (PID %s). Stop that Expo terminal with Ctrl+C, then retry.\n' "$PORT" "$PID" >&2
        ;;
      *)
        printf 'STOP: port %s belongs to another process/project (PID %s, cwd: %s). It was not stopped.\n' "$PORT" "$PID" "${PROCESS_CWD:-unavailable}" >&2
        ;;
    esac
    exit 1
  done <<< "$PIDS"
fi

printf 'LUMIS_CURRENT_BUILD commit=%s branch=%s app=normal tracked_tree=clean\n' "$COMMIT" "$BRANCH"
printf 'Starting the normal Lumis app on port %s. Keep this Terminal open; press Ctrl+C here when finished.\n' "$PORT"
printf 'Care Circle workbench is not enabled by this command.\n'

cd "$ROOT"
mkdir -p "$ROOT/.lumis-local"
MARKER_COMMIT="$COMMIT" MARKER_PORT="$PORT" node -e '
  const fs = require("node:fs");
  fs.writeFileSync(
    ".lumis-local/normal-expo-session.json",
    JSON.stringify({
      schema: "lumis_normal_expo_session_v1",
      source_commit: process.env.MARKER_COMMIT,
      port: Number(process.env.MARKER_PORT)
    }) + "\n",
    { mode: 0o600 }
  );
'
unset MARKER_COMMIT MARKER_PORT
export EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$COMMIT"
exec pnpm --dir "$MOBILE_DIR" exec expo start --tunnel --port "$PORT" --clear
