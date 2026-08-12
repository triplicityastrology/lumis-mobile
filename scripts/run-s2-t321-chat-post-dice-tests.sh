#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.chat-post-dice-release-test.json
node .tmp/chat-post-dice-release-tests/apps/mobile/src/services/chatPostDiceReleaseCandidate.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.chat-post-dice-release-test.json
node .tmp/chat-post-dice-server-tests/supabase/functions/_shared/chat-post-dice-release-candidate-v1.fixtures.js
pnpm exec tsc -p apps/mobile/tsconfig.dice-founder-product-bridge-test.json
node .tmp/dice-founder-product-bridge-tests/apps/mobile/src/services/diceFounderProductBridge.fixtures.js
bash scripts/run-s2-t311-chat-release-candidate-tests.sh
node scripts/s2-t321-refresh-chat-post-dice-seal.mjs --check
node scripts/s2-t321-chat-post-dice-contract.mjs
node scripts/s2-t321-chat-readiness.mjs
