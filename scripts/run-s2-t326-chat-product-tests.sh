#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.chat-product-path-test.json
node .tmp/chat-product-path-tests/apps/mobile/src/services/chatProductPathCandidate.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.chat-product-path-test.json
node .tmp/chat-product-path-server-tests/supabase/functions/_shared/chat-product-path-candidate-v1.fixtures.js
bash scripts/run-s2-t321-chat-post-dice-tests.sh
node scripts/s2-t326-refresh-chat-product-seal.mjs --check
node scripts/s2-t326-chat-product-contract.mjs
node scripts/s2-t326-chat-readiness.mjs
