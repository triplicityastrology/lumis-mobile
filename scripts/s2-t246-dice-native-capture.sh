#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
CONTROL="$ROOT/config/s2-t246-dice-exact-evidence.json"
MODE="${1:-status}"
shift || true
[[ "${1:-}" == "--" ]] && shift
STATE="${1:-question_validation}"
PORT="${FOUNDER_DICE_T246_SIMULATOR_PORT:-8129}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
EVIDENCE_ROOT="/Users/rubyku/Documents/Mobile App/S2-T246-Dice-Exact-Evidence"
SESSION="$EVIDENCE_ROOT/session.json"
BUNDLE_URL="http://127.0.0.1:${PORT}/apps/mobile/index.ts.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable"

stop() { printf 'STOP_S2_T246_NATIVE_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
node -e 'const c=require(process.argv[1]);if(!c.states.some(({id})=>id===process.argv[2]))process.exit(1)' "$CONTROL" "$STATE" || stop UNKNOWN_STATE
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
[[ "$(git branch --show-current)" == "codex/s2-t246-dice-exact-evidence" ]] || stop WRONG_BRANCH
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
xcrun simctl listapps "$DEVICE" | grep -Fq 'host.exp.Exponent' || stop EXPO_GO_NOT_INSTALLED
ROUTE="exp://127.0.0.1:${PORT}/--/founder-dice-t246?state=${STATE}"

fetch_bundle() {
  local output="$1"
  curl --fail --silent --max-time 90 "$BUNDLE_URL" > "$output" || stop METRO_UNAVAILABLE
  rg -Fq "$HEAD" "$output" || stop METRO_BUILD_MARKER_MISSING
  rg -Fq 'dice-capture-evidence-strip' "$output" || stop METRO_ROUTE_MISSING
  rg -Fq 'dice-zero-effects-boundary' "$output" || stop METRO_ZERO_EFFECTS_MISSING
}

if [[ "$MODE" == "status" ]]; then
  printf 'S2_T246_SIMULATOR_READY source_sha=%s state=%s human_verdict=pending live_ai_proof=false\n' "$HEAD" "$STATE"
  exit 0
fi

if [[ "$MODE" == "capture" ]]; then
  [[ -f "$SESSION" ]] || stop SESSION_MISSING
  mkdir -p "$ROOT/.tmp" "$EVIDENCE_ROOT/captures" "$EVIDENCE_ROOT/capture-receipts" "$EVIDENCE_ROOT/ocr" "$ROOT/.tmp/swift-module-cache"
  LIVE_BUNDLE="$ROOT/.tmp/s2-t246-live-bundle.js"
  fetch_bundle "$LIVE_BUNDLE"
  node scripts/s2-t246-dice-session.mjs validate "$SESSION" "$LIVE_BUNDLE" || stop SESSION_OR_BUNDLE_MISMATCH
  rm -f "$LIVE_BUNDLE"
  FILE="$EVIDENCE_ROOT/captures/${STATE}.png"
  RECEIPT="$EVIDENCE_ROOT/capture-receipts/${STATE}.json"
  OCR="$EVIDENCE_ROOT/ocr/${STATE}.txt"
  [[ ! -e "$FILE" && ! -e "$RECEIPT" && ! -e "$OCR" ]] || stop DUPLICATE_STATE_CAPTURE
  xcrun simctl ui "$DEVICE" content_size medium
  xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null || stop ROUTE_OPEN_FAILED
  PENDING="$EVIDENCE_ROOT/captures/.pending-${STATE}.png"
  MATCHED=0
  for _ in {1..10}; do
    sleep 3
    xcrun simctl io "$DEVICE" screenshot "$PENDING" >/dev/null || stop SCREENSHOT_FAILED
    [[ "$(stat -f%z "$PENDING")" -gt 30000 ]] || continue
    xcrun swift -module-cache-path "$ROOT/.tmp/swift-module-cache" scripts/s2-t243-image-text.swift "$PENDING" > "$OCR" 2>/dev/null || continue
    if node scripts/s2-t246-ocr-validate.mjs "$HEAD" "$STATE" < "$OCR" >/dev/null; then
      MATCHED=1
      break
    fi
  done
  (( MATCHED == 1 )) || { rm -f "$PENDING" "$OCR"; stop VISIBLE_EXACT_STATE_NOT_PROVEN; }
  WIDTH="$(sips -g pixelWidth "$PENDING" | awk '/pixelWidth/{print $2}')"
  HEIGHT="$(sips -g pixelHeight "$PENDING" | awk '/pixelHeight/{print $2}')"
  mv "$PENDING" "$FILE"
  chmod 0600 "$FILE" "$OCR"
  node scripts/s2-t246-record-capture.mjs "$SESSION" "$FILE" "$OCR" "$STATE" "$WIDTH" "$HEIGHT" "$RECEIPT"
  exit 0
fi

[[ "$MODE" == "launch" ]] || stop MODE_INVALID
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || stop TRACKED_TREE_DIRTY
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
mkdir -p "$EVIDENCE_ROOT"
printf 'S2_T246_NATIVE_LAUNCH source_sha=%s state=%s port=%s\n' "$HEAD" "$STATE" "$PORT"
(
  for _ in {1..60}; do
    if curl --fail --silent --max-time 2 "http://127.0.0.1:${PORT}/status" | grep -Fq 'packager-status:running'; then
      mkdir -p "$ROOT/.tmp"
      BOOT_BUNDLE="$ROOT/.tmp/s2-t246-session-bundle.js"
      fetch_bundle "$BOOT_BUNDLE"
      node scripts/s2-t246-dice-session.mjs create "$SESSION" "$BOOT_BUNDLE"
      rm -f "$BOOT_BUNDLE"
      xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null
      exit 0
    fi
    sleep 1
  done
  printf 'STOP_S2_T246_NATIVE_METRO_START_TIMEOUT\n' >&2
) &
EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY=1 EXPO_PUBLIC_DICE_GALLERY_HEAD="$HEAD" EXPO_PUBLIC_DICE_CAPTURE_STATE="$STATE" \
  exec pnpm --dir apps/mobile exec expo start --clear --port "$PORT"
