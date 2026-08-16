#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
PORT="${LUMIS_INTERNAL_DICE_LAB_PORT:-8212}"
FIXTURE_LIVE="${LUMIS_FOUNDER_DICE_FIXTURE_LIVE:-false}"
FREE_TEXT_LIVE="${LUMIS_FOUNDER_DICE_FREE_TEXT_LIVE:-false}"
[[ "$FIXTURE_LIVE" == "true" || "$FREE_TEXT_LIVE" == "true" ]] || { echo STOP_LAB_NO_LIVE_MODE >&2; exit 1; }
[[ "$(git -C "$ROOT" branch --show-current)" == "codex/s2-t359-dice-live-proof" ]] || { echo STOP_LAB_WRONG_BRANCH >&2; exit 1; }
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || { echo STOP_LAB_DIRTY_TREE >&2; exit 1; }
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
ANON_KEY="$(security find-generic-password -w -s lumis-supabase-anon-key)" || { echo STOP_LAB_ANON_KEY_UNAVAILABLE >&2; exit 1; }
ENV_ARGS=(
  "LUMIS_INTERNAL_DICE_LAB_PORT=$PORT"
  "LUMIS_FOUNDER_DICE_FIXTURE_LIVE=$FIXTURE_LIVE"
  "LUMIS_FOUNDER_DICE_FREE_TEXT_LIVE=$FREE_TEXT_LIVE"
  "LUMIS_FOUNDER_DICE_FUNCTION_URL=https://bmqhwofmdgebpcihjlnb.supabase.co/functions/v1/dice-synthetic"
  "LUMIS_FOUNDER_DICE_ANON_KEY=$ANON_KEY"
  "LUMIS_SOURCE_COMMIT=$SOURCE_COMMIT"
)

if [[ "$FIXTURE_LIVE" == "true" ]]; then
  REQUEST="${LUMIS_FOUNDER_DICE_WINDOW_REQUEST:?request path required for fixture mode}"
  RECEIPT="${LUMIS_FOUNDER_DICE_WINDOW_RECEIPT:?receipt path required for fixture mode}"
  EVIDENCE="${LUMIS_FOUNDER_DICE_TECHNICAL_EVIDENCE:-/Volumes/LumisDevSSD/Development/Evidence/S2-T345-Technical-80-Live/technical-80-metadata-receipt.json}"
  [[ -f "$REQUEST" && -f "$RECEIPT" && -f "$EVIDENCE" ]] || { echo STOP_LAB_EVIDENCE_MISSING >&2; exit 1; }
  PUBLIC_KEY="$(security find-generic-password -w -s lumis-founder-public-key-path)" || { echo STOP_LAB_PUBLIC_KEY_UNAVAILABLE >&2; exit 1; }
  REQUEST_SHA="$(node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1]));if(!/^[a-f0-9]{64}$/.test(x.request_sha256))process.exit(1);process.stdout.write(x.request_sha256)' "$REQUEST")"
  PACKAGE_SHA="$(node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1]));if(!/^[a-f0-9]{64}$/.test(x.lab_package_sha256))process.exit(1);process.stdout.write(x.lab_package_sha256)' "$REQUEST")"
  REGISTRY_SHA="$(node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1]));if(!/^[a-f0-9]{64}$/.test(x.founder_registry_sha256))process.exit(1);process.stdout.write(x.founder_registry_sha256)' "$REQUEST")"
  ENV_ARGS+=(
    "LUMIS_FOUNDER_DICE_TECHNICAL_EVIDENCE=$EVIDENCE"
    "LUMIS_FOUNDER_DICE_WINDOW_REQUEST_SHA256=$REQUEST_SHA"
    "LUMIS_FOUNDER_DICE_WINDOW_RECEIPT=$RECEIPT"
    "LUMIS_FOUNDER_DICE_PUBLIC_KEY=$PUBLIC_KEY"
    "LUMIS_FOUNDER_DICE_REGISTRY_SHA256=$REGISTRY_SHA"
    "LUMIS_FOUNDER_DICE_LAB_PACKAGE_SHA256=$PACKAGE_SHA"
  )
fi

if [[ "$FREE_TEXT_LIVE" == "true" ]]; then
  FREE_TEXT_ACCESS_KEY="$(security find-generic-password -w -s lumis-dice-founder-free-text-access-key 2>/dev/null)" || { echo STOP_LAB_FREE_TEXT_ACCESS_UNAVAILABLE >&2; exit 1; }
  [[ "${#FREE_TEXT_ACCESS_KEY}" -ge 32 ]] || { echo STOP_LAB_FREE_TEXT_ACCESS_INVALID >&2; exit 1; }
  ENV_ARGS+=("LUMIS_FOUNDER_DICE_FREE_TEXT_ACCESS_KEY=$FREE_TEXT_ACCESS_KEY")
fi

exec env "${ENV_ARGS[@]}" node "$ROOT/tools/internal-dice-ai-lab/server.mjs"
