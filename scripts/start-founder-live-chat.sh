#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=lib/lumis-worktree-root.sh
source "$SCRIPT_DIR/lib/lumis-worktree-root.sh"
ROOT="$(lumis_resolve_worktree_root)" || { printf 'STOP_FOUNDER_LIVE_CHAT_INVALID_WORKTREE\n' >&2; exit 1; }
PORT="${FOUNDER_CHAT_EXPO_PORT:-8228}"
if [[ "${1:-}" == "--" ]]; then shift; fi
MODE="${1:---lan}"
stop() { printf 'STOP_FOUNDER_LIVE_CHAT_%s\n' "$1" >&2; exit 1; }

[[ "$ROOT" == /Volumes/LumisDevSSD/Development/Worktrees/* ]] || stop SSD_WORKTREE_REQUIRED
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t350-normal-chat-mobile-live" ]] || stop WRONG_BRANCH
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED_NO_PROCESS_KILLED
case "$MODE" in --lan|--tunnel) ;; *) stop INVALID_MODE ;; esac

DEV_ROOT="${LUMIS_DEV_ROOT:-$(cd "$ROOT/../../.." && pwd -P)}"
PNPM_STORE_PATH="${LUMIS_PNPM_STORE_PATH:-$DEV_ROOT/Dependencies/pnpm-store}"
NPM_CACHE_PATH="${LUMIS_NPM_CACHE_PATH:-$DEV_ROOT/Dependencies/npm-cache}"
TMP_PATH="${LUMIS_BUILD_TMP:-$DEV_ROOT/BuildCaches/Founder-Live-Chat-tmp}"
[[ -d "$PNPM_STORE_PATH" ]] || stop PNPM_STORE_MISSING
mkdir -p "$NPM_CACHE_PATH" "$TMP_PATH"

HEAD="$(git -C "$ROOT" rev-parse HEAD)"
PUBLIC_ENV_FILE="$ROOT/apps/mobile/.env"
HAS_URL=0
HAS_KEY=0
if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]] || { [[ -f "$PUBLIC_ENV_FILE" ]] && grep -Eq '^EXPO_PUBLIC_SUPABASE_URL=.+$' "$PUBLIC_ENV_FILE"; }; then HAS_URL=1; fi
if [[ -n "${EXPO_PUBLIC_SUPABASE_KEY:-}${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]] || { [[ -f "$PUBLIC_ENV_FILE" ]] && grep -Eq '^EXPO_PUBLIC_SUPABASE_(KEY|PUBLISHABLE_KEY|ANON_KEY)=.+$' "$PUBLIC_ENV_FILE"; }; then HAS_KEY=1; fi
[[ "$HAS_URL" == 1 && "$HAS_KEY" == 1 ]] || stop PUBLIC_SUPABASE_CONFIG_REQUIRED
printf 'FOUNDER_LIVE_CHAT_READY source_sha=%s route=product_chat mode=closed_fixture_live_candidate port=%s persistence=false units=false\n' "$HEAD" "$PORT"
cd "$ROOT"
EXPO_PUBLIC_T341_CHAT_LOCAL_FIXTURE=1 \
EXPO_PUBLIC_T341_CHAT_FIXTURE_STATE="${FOUNDER_CHAT_FIXTURE_STATE:-completed}" \
EXPO_PUBLIC_FOUNDER_CHAT_LIVE_MODE=1 \
EXPO_PUBLIC_FOUNDER_CHAT_DICE_EVIDENCE_SHA256=f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612 \
npm_config_cache="$NPM_CACHE_PATH" \
TMPDIR="$TMP_PATH" \
exec pnpm --dir apps/mobile exec expo start "$MODE" --clear --port "$PORT"
