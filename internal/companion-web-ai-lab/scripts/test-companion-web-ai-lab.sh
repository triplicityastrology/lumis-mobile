#!/usr/bin/env bash
# Compile + run the Companion / Normal Chat Web AI Lab test suite and static contract checks.
set -euo pipefail
LAB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$LAB_DIR/../.." && pwd)"
cd "$ROOT"
"$ROOT/node_modules/.bin/tsc" -p "$LAB_DIR/tsconfig.json"
node "$ROOT/.tmp/companion-web-ai-lab/internal/companion-web-ai-lab/test/lab-engine.fixtures.js"
node "$ROOT/.tmp/companion-web-ai-lab/internal/companion-web-ai-lab/test/lab-live-window.fixtures.js"
node "$LAB_DIR/scripts/companion-web-ai-lab-contract.mjs"
# clean up transient test ledgers
rm -f "$ROOT"/.tmp/test-live-*.json 2>/dev/null || true
