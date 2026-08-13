#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=lib/lumis-worktree-root.sh
source "$SCRIPT_DIR/lib/lumis-worktree-root.sh"

stop() { printf 'STOP_S2_T337_%s\n' "$1" >&2; exit 1; }
ROOT="$(lumis_resolve_worktree_root)" || stop WORKTREE_ROOT_INVALID
PORT="${FOUNDER_T337_EXPO_PORT:-8202}"
MODE="${1:---lan}"
FIXTURE="${FOUNDER_T337_FIXTURE_STATE:-completed}"
SSD_ROOT="${LUMIS_SSD_DEVELOPMENT_ROOT:-/Volumes/LumisDevSSD/Development}"
PNPM_STORE="${PNPM_STORE_DIR:-$SSD_ROOT/Dependencies/pnpm-store}"
NPM_CACHE="${npm_config_cache:-$SSD_ROOT/Dependencies/npm-cache}"
EXPO_CACHE="${XDG_CACHE_HOME:-$SSD_ROOT/BuildCaches/Expo/s2-t337}"
TMP_ROOT="${TMPDIR:-$SSD_ROOT/BuildCaches/Tmp/s2-t337}"

case "$ROOT" in
  "$SSD_ROOT"/Worktrees/*) ;;
  *) stop SSD_WORKTREE_REQUIRED ;;
esac
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t337-canonical-customer-dice-rc" ]] || stop WRONG_BRANCH
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || stop INVALID_PORT
[[ "$MODE" == "--lan" || "$MODE" == "--tunnel" || "$MODE" == "--simulator" ]] || stop MODE_INVALID
[[ "$FIXTURE" == "completed" || "$FIXTURE" == "safety" || "$FIXTURE" == "fallback" || "$FIXTURE" == "technical_error" ]] || stop FIXTURE_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED

HEAD="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop BUILD_MARKER_INVALID
mkdir -p "$EXPO_CACHE" "$TMP_ROOT"
export PNPM_STORE_DIR="$PNPM_STORE"
export npm_config_cache="$NPM_CACHE"
export XDG_CACHE_HOME="$EXPO_CACHE"
export TMPDIR="$TMP_ROOT"

printf 'S2_T337_CUSTOMER_DICE_READY\nBUILD=%s\nROUTE=customer-dice\nFIXTURE=%s\nEFFECTS=provider_0,persistence_0,units_0\nPORT=%s\n' "$HEAD" "$FIXTURE" "$PORT"

ARGS=(start --clear --port "$PORT")
if [[ "$MODE" == "--simulator" ]]; then ARGS+=(--ios); else ARGS+=("$MODE"); fi

cd "$ROOT"
EXPO_PUBLIC_DICE_RITUAL=1 \
EXPO_PUBLIC_DICE_CUSTOMER_LOCAL_FIXTURE="$FIXTURE" \
EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$HEAD" \
EXPO_PUBLIC_SUPABASE_URL= \
EXPO_PUBLIC_SUPABASE_KEY= \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
EXPO_PUBLIC_SUPABASE_ANON_KEY= \
exec pnpm --store-dir "$PNPM_STORE" --dir apps/mobile exec expo "${ARGS[@]}"
