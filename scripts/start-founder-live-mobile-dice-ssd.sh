#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=lib/lumis-worktree-root.sh
source "$SCRIPT_DIR/lib/lumis-worktree-root.sh"

stop() { printf 'STOP_FOUNDER_LIVE_MOBILE_DICE_%s\n' "$1" >&2; exit 1; }
ROOT="$(lumis_resolve_worktree_root)" || stop WORKTREE_ROOT_INVALID
SSD_ROOT="${LUMIS_SSD_DEVELOPMENT_ROOT:-/Volumes/LumisDevSSD/Development}"
PORT="${FOUNDER_LIVE_MOBILE_DICE_PORT:-8222}"
RELAY_PORT="${FOUNDER_LIVE_MOBILE_DICE_RELAY_PORT:-8223}"
MODE="${1:---lan}"
EVIDENCE_ROOT="${LUMIS_TECHNICAL_80_EVIDENCE_ROOT:-$SSD_ROOT/Evidence/S2-T345-Technical-80-Live}"
TECHNICAL_RECEIPT="$EVIDENCE_ROOT/technical-80-metadata-receipt.json"
EXPECTED_TECHNICAL_RECEIPT_SHA="f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612"
RECEIPT_POINTER="$SSD_ROOT/Evidence/S2-Founder-Web-Lab-Live/current-receipt-path.txt"
RECEIPT_FILE="${FOUNDER_DICE_LIVE_WINDOW_RECEIPT_FILE:-}"
if [[ -z "$RECEIPT_FILE" && -f "$RECEIPT_POINTER" ]]; then RECEIPT_FILE="$(<"$RECEIPT_POINTER")"; fi

case "$ROOT" in "$SSD_ROOT"/Worktrees/*) ;; *) stop SSD_WORKTREE_REQUIRED ;; esac
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t349-mobile-dice-live-candidate" ]] || stop WRONG_BRANCH
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || stop INVALID_PORT
[[ "$RELAY_PORT" =~ ^[0-9]+$ && "$RELAY_PORT" -ge 1024 && "$RELAY_PORT" -le 65535 && "$RELAY_PORT" != "$PORT" ]] || stop INVALID_RELAY_PORT
[[ "$MODE" == "--lan" || "$MODE" == "--tunnel" || "$MODE" == "--ios" ]] || stop MODE_INVALID
[[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop PORT_OCCUPIED
[[ -z "$(lsof -tiTCP:"$RELAY_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)" ]] || stop RELAY_PORT_OCCUPIED
[[ -f "$TECHNICAL_RECEIPT" ]] || stop TECHNICAL_EVIDENCE_MISSING
[[ "$(shasum -a 256 "$TECHNICAL_RECEIPT" | awk '{print $1}')" == "$EXPECTED_TECHNICAL_RECEIPT_SHA" ]] || stop TECHNICAL_EVIDENCE_DRIFT

ANON_KEY="$(security find-generic-password -w -s lumis-supabase-anon-key 2>/dev/null)" || stop PUBLIC_CONFIG_UNAVAILABLE
[[ -n "$ANON_KEY" && "$ANON_KEY" != sb_secret_* && "$ANON_KEY" != *service_role* ]] || stop PUBLIC_CONFIG_UNSAFE
PUBLIC_KEY_FILE="$(security find-generic-password -w -s lumis-founder-public-key-path 2>/dev/null)" || stop PUBLIC_KEY_REFERENCE_UNAVAILABLE
[[ -f "$PUBLIC_KEY_FILE" ]] || stop PUBLIC_KEY_FILE_UNAVAILABLE
[[ -n "$RECEIPT_FILE" && -f "$RECEIPT_FILE" ]] || stop FOUNDER_WINDOW_RECEIPT_MISSING
FOUNDER_RECEIPT_SHA="$(shasum -a 256 "$RECEIPT_FILE" | awk '{print $1}')"

HEAD="$(git -C "$ROOT" rev-parse HEAD)"
PNPM_STORE="${PNPM_STORE_DIR:-$SSD_ROOT/Dependencies/pnpm-store}"
NPM_CACHE="${npm_config_cache:-$SSD_ROOT/Dependencies/npm-cache}"
EXPO_CACHE="${XDG_CACHE_HOME:-$SSD_ROOT/BuildCaches/Expo/founder-live-mobile-dice}"
TMP_ROOT="${TMPDIR:-$SSD_ROOT/BuildCaches/Tmp/founder-live-mobile-dice}"
mkdir -p "$EXPO_CACHE" "$TMP_ROOT"
export PNPM_STORE_DIR="$PNPM_STORE" npm_config_cache="$NPM_CACHE" XDG_CACHE_HOME="$EXPO_CACHE" TMPDIR="$TMP_ROOT"

[[ "$FOUNDER_RECEIPT_SHA" =~ ^[0-9a-f]{64}$ ]] || stop FOUNDER_EVIDENCE_INVALID
if [[ "$MODE" == "--ios" ]]; then
  RELAY_HOST="127.0.0.1"
else
  RELAY_HOST="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  [[ "$RELAY_HOST" =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]] || stop LAN_ADDRESS_UNAVAILABLE
fi
RELAY_SESSION="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
[[ "${#RELAY_SESSION}" -eq 43 ]] || stop RELAY_SESSION_INVALID

cleanup() {
  if [[ -n "${RELAY_PID:-}" ]]; then kill "$RELAY_PID" 2>/dev/null || true; wait "$RELAY_PID" 2>/dev/null || true; fi
  unset ANON_KEY PUBLIC_KEY_FILE RELAY_SESSION
}
trap cleanup EXIT INT TERM

LUMIS_DICE_MOBILE_RELAY_PORT="$RELAY_PORT" \
LUMIS_DICE_MOBILE_RELAY_SESSION="$RELAY_SESSION" \
LUMIS_DICE_MOBILE_ANON_KEY="$ANON_KEY" \
LUMIS_DICE_FOUNDER_RECEIPT_FILE="$RECEIPT_FILE" \
LUMIS_DICE_FOUNDER_RECEIPT_SHA256="$FOUNDER_RECEIPT_SHA" \
LUMIS_DICE_FOUNDER_PUBLIC_KEY_FILE="$PUBLIC_KEY_FILE" \
node scripts/founder-mobile-dice-relay.mjs &
RELAY_PID=$!
for _ in {1..40}; do
  if curl --silent --fail "http://127.0.0.1:$RELAY_PORT/health" >/dev/null 2>&1; then break; fi
  kill -0 "$RELAY_PID" 2>/dev/null || stop RELAY_START_FAILED
  sleep 0.25
done
curl --silent --fail "http://127.0.0.1:$RELAY_PORT/health" >/dev/null 2>&1 || stop RELAY_HEALTH_FAILED

printf 'FOUNDER_LIVE_MOBILE_DICE_READY\nsource_commit=%s\nroute=customer-dice\ntechnical_80=accepted\nlive_transport=receipt_verified_server_relay\nexpo_port=%s\nrelay_port=%s\n' "$HEAD" "$PORT" "$RELAY_PORT"

ARGS=(start --clear --port "$PORT")
if [[ "$MODE" == "--ios" ]]; then ARGS+=(--ios); else ARGS+=("$MODE"); fi

cd "$ROOT"
EXPO_PUBLIC_DICE_RITUAL=1 \
EXPO_PUBLIC_DICE_CUSTOMER_LOCAL_FIXTURE= \
EXPO_PUBLIC_DICE_AI_ENABLED=1 \
EXPO_PUBLIC_DICE_TRAFFIC_AUTHORIZED=1 \
EXPO_PUBLIC_DICE_FOUNDER_WINDOW_EVIDENCE_SHA256="$FOUNDER_RECEIPT_SHA" \
EXPO_PUBLIC_DICE_ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256="$FOUNDER_RECEIPT_SHA" \
EXPO_PUBLIC_DICE_MOBILE_RELAY_URL="http://$RELAY_HOST:$RELAY_PORT/dice" \
EXPO_PUBLIC_DICE_MOBILE_RELAY_SESSION="$RELAY_SESSION" \
EXPO_PUBLIC_FOUNDER_LIVE_MOBILE_DICE=1 \
EXPO_PUBLIC_SUPABASE_URL= \
EXPO_PUBLIC_SUPABASE_ANON_KEY= \
EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$HEAD" \
pnpm --dir apps/mobile exec expo "${ARGS[@]}"
