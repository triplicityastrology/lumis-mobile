#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
CONTROL="$ROOT/supabase/tests/s2-t243-dice-capture-control.json"
MODE="${1:-status}"
shift || true
[[ "${1:-}" == "--" ]] && shift
STATE="${1:-invalid_hi}"
PORT="${FOUNDER_DICE_SIMULATOR_PORT:-8117}"
DEVICE="${FOUNDER_SIMULATOR_UDID:-59A01E18-328F-4AF1-9F40-993183F808AD}"
EVIDENCE_ROOT="/Users/rubyku/Documents/Mobile App/S2-T243-Dice-Interactive-Evidence"
SESSION="$EVIDENCE_ROOT/session.json"

stop() { printf 'STOP_S2_T243_NATIVE_%s\n' "$1" >&2; exit 1; }
cd "$ROOT"
node -e 'const c=require(process.argv[1]);if(!c.states.includes(process.argv[2]))process.exit(1)' "$CONTROL" "$STATE" || stop UNKNOWN_STATE
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65534 )) || stop PORT_INVALID
HEAD="$(git rev-parse HEAD)"
[[ "$HEAD" =~ ^[0-9a-f]{40}$ ]] || stop SOURCE_SHA_INVALID
[[ -z "$(git status --porcelain --untracked-files=no)" || "$MODE" != "launch" ]] || stop TRACKED_TREE_DIRTY
xcrun simctl list devices booted | grep -Fq "$DEVICE" || stop SIMULATOR_NOT_BOOTED
xcrun simctl listapps "$DEVICE" | grep -Fq 'host.exp.Exponent' || stop EXPO_GO_NOT_INSTALLED
ROUTE="exp://127.0.0.1:${PORT}/--/founder-dice-t243?state=${STATE}"

if [[ "$MODE" == "status" ]]; then
  printf 'S2_T243_SIMULATOR_READY source_sha=%s state=%s human_verdict=pending live_ai_proof=false\n' "$HEAD" "$STATE"
  exit 0
fi

verify_bundle() {
  local bundle="$ROOT/.tmp/s2-t243-bundle-check.js"
  mkdir -p "$ROOT/.tmp"
  curl --fail --silent --max-time 90 "http://127.0.0.1:${PORT}/apps/mobile/index.ts.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable" > "$bundle" || stop METRO_UNAVAILABLE
  rg -Fq "$HEAD" "$bundle" || stop METRO_BUNDLE_MARKER_MISSING
  rg -Fq 'dice-capture-evidence-strip' "$bundle" || stop METRO_GALLERY_ROUTE_MISSING
  rg -Fq 'dice-zero-effects-boundary' "$bundle" || stop METRO_ZERO_EFFECT_LABEL_MISSING
  rm -f "$bundle"
}

if [[ "$MODE" == "capture" ]]; then
  [[ -f "$SESSION" ]] || stop SESSION_MISSING
  verify_bundle
  node -e 'const s=require(process.argv[1]);if(s.source_sha!==process.argv[2]||s.build_marker!==process.argv[2]||s.port!==Number(process.argv[3])||s.route_prefix!=="founder-dice-t243")process.exit(1)' "$SESSION" "$HEAD" "$PORT" || stop SESSION_MISMATCH
  mkdir -p "$EVIDENCE_ROOT/captures" "$EVIDENCE_ROOT/capture-receipts"
  FILE="$EVIDENCE_ROOT/captures/${STATE}.png"
  xcrun simctl ui "$DEVICE" content_size medium
  xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null
  sleep 7
  PENDING="$EVIDENCE_ROOT/captures/.pending-${STATE}.png"
  mkdir -p "$ROOT/.tmp/swift-module-cache"
  MATCHED=0
  for _ in {1..8}; do
    sleep 4
    xcrun simctl io "$DEVICE" screenshot "$PENDING" >/dev/null
    TEXT="$(xcrun swift -module-cache-path "$ROOT/.tmp/swift-module-cache" scripts/s2-t243-image-text.swift "$PENDING" 2>/dev/null || true)"
    if printf '%s' "$TEXT" | node scripts/s2-t243-ocr-marker.mjs "$HEAD" "$STATE" >/dev/null && \
      ! printf '%s' "$TEXT" | grep -Eqi "could.?n.?t load your space|unable to resolve|something went wrong|loading from|opening project|development servers|send magic link"; then
      MATCHED=1
      break
    fi
    xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null 2>&1 || true
  done
  (( MATCHED == 1 )) || stop VISIBLE_BUILD_OR_STATE_MARKER_MISSING
  [[ ! -e "$FILE" ]] || stop DUPLICATE_STATE_CAPTURE
  mv "$PENDING" "$FILE"
  chmod 0600 "$FILE"
  WIDTH="$(sips -g pixelWidth "$FILE" | awk '/pixelWidth/{print $2}')"
  HEIGHT="$(sips -g pixelHeight "$FILE" | awk '/pixelHeight/{print $2}')"
  HASH="$(shasum -a 256 "$FILE" | awk '{print $1}')"
  SESSION_NONCE="$(node -e 'process.stdout.write(require(process.argv[1]).session_nonce)' "$SESSION")"
  CAPTURED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  RECEIPT="$EVIDENCE_ROOT/capture-receipts/${STATE}.json"
  RECEIPT="$RECEIPT" SOURCE_SHA="$HEAD" NONCE="$SESSION_NONCE" DEVICE="$DEVICE" STATE="$STATE" HASH="$HASH" WIDTH="$WIDTH" HEIGHT="$HEIGHT" CAPTURED_AT="$CAPTURED_AT" node --input-type=module -e '
    import { writeFileSync } from "node:fs";
    const state=process.env.STATE;
    const value={schema:"s2_t243_dice_capture_receipt_v1",source_sha:process.env.SOURCE_SHA,build_marker:process.env.SOURCE_SHA,session_nonce:process.env.NONCE,device_udid:process.env.DEVICE,state,route:`founder-dice-t243?state=${state}`,visible_fixture_label:`STATE ${state}`,file:`captures/${state}.png`,image_sha256:process.env.HASH,width:Number(process.env.WIDTH),height:Number(process.env.HEIGHT),captured_at:process.env.CAPTURED_AT,live_ai_proof:false,units_consumed:0,persistence_writes:0};
    writeFileSync(process.env.RECEIPT,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});'
  printf 'S2_T243_CAPTURED source_sha=%s state=%s image_sha256=%s receipt=%s\n' "$HEAD" "$STATE" "$HASH" "$RECEIPT"
  exit 0
fi

[[ "$MODE" == "launch" ]] || stop MODE_INVALID
PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
[[ -z "$PID" ]] || stop PORT_OCCUPIED
mkdir -p "$EVIDENCE_ROOT"
NONCE="$(openssl rand -hex 32)"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SESSION="$SESSION" SOURCE_SHA="$HEAD" NONCE="$NONCE" DEVICE="$DEVICE" PORT="$PORT" CREATED_AT="$CREATED_AT" node --input-type=module -e '
  import { writeFileSync } from "node:fs";
  const value={schema:"s2_t243_dice_capture_session_v1",source_sha:process.env.SOURCE_SHA,build_marker:process.env.SOURCE_SHA,route_prefix:"founder-dice-t243",port:Number(process.env.PORT),device_udid:process.env.DEVICE,session_nonce:process.env.NONCE,created_at:process.env.CREATED_AT};
  writeFileSync(process.env.SESSION,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});'
printf 'S2_T243_NATIVE_LAUNCH source_sha=%s state=%s human_verdict=pending live_ai_proof=false\n' "$HEAD" "$STATE"
(
  for _ in {1..60}; do
    if curl --fail --silent --max-time 2 "http://127.0.0.1:${PORT}/status" | grep -Fq "packager-status:running"; then
      xcrun simctl openurl "$DEVICE" "$ROUTE" >/dev/null
      exit 0
    fi
    sleep 1
  done
  printf 'STOP_S2_T243_NATIVE_METRO_START_TIMEOUT\n' >&2
) &
EXPO_PUBLIC_DICE_INTERPRETATION_GALLERY=1 EXPO_PUBLIC_DICE_GALLERY_HEAD="$HEAD" EXPO_PUBLIC_DICE_CAPTURE_STATE="$STATE" EXPO_PUBLIC_DICE_CAPTURE_SESSION="$NONCE" \
  exec pnpm --dir apps/mobile exec expo start --clear --port "$PORT"
