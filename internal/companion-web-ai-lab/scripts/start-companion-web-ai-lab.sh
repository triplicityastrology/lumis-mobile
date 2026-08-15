#!/usr/bin/env bash
# Start the Companion / Normal Chat Web AI Lab (INTERNAL testing tool — not the signed-off UI).
# Default-off: with no LUMIS_CHAT_* env set, the Lab makes ZERO provider calls.
#
# Optional (server-side only) to enable one real staging generative call:
#   export LUMIS_CHAT_AI_ENABLED=true
#   export LUMIS_CHAT_AZURE_API_KEY=<staging key>   # never sent to the browser
set -euo pipefail
LAB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$LAB_DIR/../.." && pwd)"
PORT="${LAB_PORT:-8410}"
cd "$ROOT"
"$ROOT/node_modules/.bin/tsc" -p "$LAB_DIR/tsconfig.json"
echo "Companion/Normal Chat Web AI Lab — open http://localhost:${PORT}"
LAB_PORT="$PORT" LAB_PUBLIC_DIR="$LAB_DIR/public" exec node "$ROOT/.tmp/companion-web-ai-lab/internal/companion-web-ai-lab/src/server.js"
