#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.chat-after-dice-root-test.json
node .tmp/chat-after-dice-root-tests/apps/mobile/src/services/chatAfterDiceRoot.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.chat-after-dice-root-test.json
node .tmp/chat-after-dice-root-server-tests/supabase/functions/_shared/chat-after-dice-root-v1.fixtures.js
node scripts/s2-t331-refresh-chat-after-dice-seal.mjs --check
node scripts/s2-t331-chat-after-dice-contract.mjs
node scripts/s2-t331-chat-after-dice-emulator.mjs
node scripts/s2-t331-chat-readiness.mjs
