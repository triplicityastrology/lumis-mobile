#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ "${1:-}" == "--run" && $# == 9 ]] || { printf 'STOP_S2_T315_TRAFFIC_USAGE\n' >&2; exit 1; }
CANDIDATE="$2"; DEPLOYMENT="$3"; MIGRATION="$4"; AUTHORIZATION="$5"; PUBLIC_KEY="$6"; ADAPTER="$7"; RATINGS="$8"; OUTPUT="$9"
# Candidate, prerequisite receipts, Founder signature, limits, and scope all validate before adapter construction.
node "$ROOT/scripts/s2-t315-technical-80-operator.mjs" preflight --candidate "$CANDIDATE" --post-deploy-receipt "$DEPLOYMENT" --migration-receipt "$MIGRATION" --authorization "$AUTHORIZATION" --issuer-public-key "$PUBLIC_KEY" >/dev/null
node "$ROOT/scripts/s2-t315-technical-80-operator.mjs" claim --candidate "$CANDIDATE" --post-deploy-receipt "$DEPLOYMENT" --migration-receipt "$MIGRATION" --authorization "$AUTHORIZATION" --issuer-public-key "$PUBLIC_KEY" >/dev/null
COMPAT="$(mktemp -d "${TMPDIR:-/tmp}/s2-t315-receipts.XXXXXX")"
chmod 700 "$COMPAT"
node "$ROOT/scripts/s2-t315-technical-80-operator.mjs" emit-t309-receipts --candidate "$CANDIDATE" --post-deploy-receipt "$DEPLOYMENT" --migration-receipt "$MIGRATION" --authorization "$AUTHORIZATION" --issuer-public-key "$PUBLIC_KEY" --output-dir "$COMPAT" >/dev/null
finish(){ printf 'S2_T315_FINALLY_DISABLE_REQUIRED run_scope=DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY\n' >&2; }
cleanup(){ rm -rf "$COMPAT"; finish; }
trap cleanup EXIT INT TERM
node "$ROOT/scripts/s2-t309-dice-80-live-window.mjs" run --deployment-receipt "$COMPAT/deployment.json" --migration-receipt "$COMPAT/migration.json" --traffic-receipt "$COMPAT/traffic.json" --gateway-adapter "$ADAPTER" --ratings "$RATINGS" --output-dir "$OUTPUT"
