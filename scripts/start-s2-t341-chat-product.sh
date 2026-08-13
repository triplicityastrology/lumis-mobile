#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=lib/lumis-worktree-root.sh
source "$SCRIPT_DIR/lib/lumis-worktree-root.sh"
ROOT="$(lumis_resolve_worktree_root)" || { printf 'STOP_S2_T341_INVALID_WORKTREE\n' >&2; exit 1; }
PORT="${T341_CHAT_EXPO_PORT:-8202}"
MODE="${1:---lan}"
STATE="${T341_CHAT_FIXTURE_STATE:-completed}"
stop() { printf 'STOP_S2_T341_%s\n' "$1" >&2; exit 1; }

[[ "$ROOT" == /Volumes/* ]] || stop SSD_WORKTREE_REQUIRED
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t341-chat-product-integration-rc" ]] || stop WRONG_BRANCH
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || stop INVALID_PORT
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
[[ "$STATE" =~ ^(completed|fallback|safety|technical_error)$ ]] || stop INVALID_FIXTURE_STATE
case "$MODE" in
  --lan|--tunnel) EXPO_MODE="$MODE"; OPEN_IOS=0 ;;
  --simulator) EXPO_MODE="--localhost"; OPEN_IOS=1 ;;
  *) stop INVALID_MODE ;;
esac

DEV_ROOT="${LUMIS_DEV_ROOT:-$(cd "$ROOT/../../.." && pwd -P)}"
[[ "$DEV_ROOT" == /Volumes/* ]] || stop SSD_DEVELOPMENT_ROOT_REQUIRED
PNPM_STORE_PATH="${LUMIS_PNPM_STORE_PATH:-$DEV_ROOT/Dependencies/pnpm-store}"
NPM_CACHE_PATH="${LUMIS_NPM_CACHE_PATH:-$DEV_ROOT/Dependencies/npm-cache}"
TMP_PATH="${LUMIS_BUILD_TMP:-$DEV_ROOT/BuildCaches/T341-tmp}"
[[ -d "$PNPM_STORE_PATH" ]] || stop PNPM_STORE_MISSING
mkdir -p "$NPM_CACHE_PATH" "$TMP_PATH"

HEAD="$(git -C "$ROOT" rev-parse HEAD)"
printf 'S2_T341_CHAT_PRODUCT_READY source_sha=%s route=real-chat-product mode=local_fixture state=%s port=%s live_authority=false persistence=false units=false\n' "$HEAD" "$STATE" "$PORT"
cd "$ROOT"
EXPO_PUBLIC_T341_CHAT_LOCAL_FIXTURE=1 \
EXPO_PUBLIC_T341_CHAT_FIXTURE_STATE="$STATE" \
EXPO_PUBLIC_SUPABASE_URL= \
EXPO_PUBLIC_SUPABASE_KEY= \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
EXPO_PUBLIC_SUPABASE_ANON_KEY= \
npm_config_cache="$NPM_CACHE_PATH" \
TMPDIR="$TMP_PATH" \
exec pnpm --dir apps/mobile exec expo start "$EXPO_MODE" --clear --port "$PORT" $([[ "$OPEN_IOS" == 1 ]] && printf '%s' '--ios')
