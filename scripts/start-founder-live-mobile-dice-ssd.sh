#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=lib/lumis-worktree-root.sh
source "$SCRIPT_DIR/lib/lumis-worktree-root.sh"

stop() { printf 'STOP_FOUNDER_LIVE_MOBILE_DICE_%s\n' "$1" >&2; exit 1; }
ROOT="$(lumis_resolve_worktree_root)" || stop WORKTREE_ROOT_INVALID
SSD_ROOT="${LUMIS_SSD_DEVELOPMENT_ROOT:-/Volumes/LumisDevSSD/Development}"
PORT="${FOUNDER_LIVE_MOBILE_DICE_PORT:-8212}"
MODE="${1:---lan}"
EVIDENCE_ROOT="${LUMIS_TECHNICAL_80_EVIDENCE_ROOT:-$SSD_ROOT/Evidence/S2-T345-Technical-80-Live}"
TECHNICAL_RECEIPT="$EVIDENCE_ROOT/technical-80-metadata-receipt.json"
EXPECTED_TECHNICAL_RECEIPT_SHA="f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612"
FOUNDER_RECEIPT_SHA="${FOUNDER_DICE_LIVE_WINDOW_EVIDENCE_SHA256:-}"
PROJECT_URL="https://bmqhwofmdgebpcihjlnb.supabase.co"

case "$ROOT" in "$SSD_ROOT"/Worktrees/*) ;; *) stop SSD_WORKTREE_REQUIRED ;; esac
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/founder-live-mobile-dice" ]] || stop WRONG_BRANCH
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || stop INVALID_PORT
[[ "$MODE" == "--lan" || "$MODE" == "--tunnel" || "$MODE" == "--ios" ]] || stop MODE_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
[[ -f "$TECHNICAL_RECEIPT" ]] || stop TECHNICAL_EVIDENCE_MISSING
[[ "$(shasum -a 256 "$TECHNICAL_RECEIPT" | awk '{print $1}')" == "$EXPECTED_TECHNICAL_RECEIPT_SHA" ]] || stop TECHNICAL_EVIDENCE_DRIFT

ANON_KEY="$(security find-generic-password -w -s lumis-supabase-anon-key 2>/dev/null)" || stop PUBLIC_CONFIG_UNAVAILABLE
[[ -n "$ANON_KEY" && "$ANON_KEY" != sb_secret_* && "$ANON_KEY" != *service_role* ]] || stop PUBLIC_CONFIG_UNSAFE

HEAD="$(git -C "$ROOT" rev-parse HEAD)"
PNPM_STORE="${PNPM_STORE_DIR:-$SSD_ROOT/Dependencies/pnpm-store}"
NPM_CACHE="${npm_config_cache:-$SSD_ROOT/Dependencies/npm-cache}"
EXPO_CACHE="${XDG_CACHE_HOME:-$SSD_ROOT/BuildCaches/Expo/founder-live-mobile-dice}"
TMP_ROOT="${TMPDIR:-$SSD_ROOT/BuildCaches/Tmp/founder-live-mobile-dice}"
mkdir -p "$EXPO_CACHE" "$TMP_ROOT"
export PNPM_STORE_DIR="$PNPM_STORE" npm_config_cache="$NPM_CACHE" XDG_CACHE_HOME="$EXPO_CACHE" TMPDIR="$TMP_ROOT"

if [[ -n "$FOUNDER_RECEIPT_SHA" && ! "$FOUNDER_RECEIPT_SHA" =~ ^[0-9a-f]{64}$ ]]; then stop FOUNDER_EVIDENCE_INVALID; fi
if [[ -n "$FOUNDER_RECEIPT_SHA" ]]; then LIVE_STATUS="pending_source_pin_review"; else LIVE_STATUS="blocked_no_founder_window_receipt"; fi
printf 'FOUNDER_LIVE_MOBILE_DICE_READY\nsource_commit=%s\nroute=customer-dice\ntechnical_80=accepted\nlive_transport=%s\nport=%s\n' "$HEAD" "$LIVE_STATUS" "$PORT"

ARGS=(start --clear --port "$PORT")
if [[ "$MODE" == "--ios" ]]; then ARGS+=(--ios); else ARGS+=("$MODE"); fi

cd "$ROOT"
EXPO_PUBLIC_DICE_RITUAL=1 \
EXPO_PUBLIC_DICE_CUSTOMER_LOCAL_FIXTURE= \
EXPO_PUBLIC_DICE_AI_ENABLED=1 \
EXPO_PUBLIC_DICE_TRAFFIC_AUTHORIZED=1 \
EXPO_PUBLIC_DICE_FOUNDER_WINDOW_EVIDENCE_SHA256="$FOUNDER_RECEIPT_SHA" \
EXPO_PUBLIC_SUPABASE_URL="$PROJECT_URL" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$HEAD" \
exec pnpm --dir apps/mobile exec expo "${ARGS[@]}"
