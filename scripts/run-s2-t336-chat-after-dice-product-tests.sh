#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.chat-after-dice-product-test.json
node .tmp/chat-after-dice-product-tests/apps/mobile/src/services/chatAfterDiceProductCandidate.fixtures.js
node scripts/s2-normal-chat-contract.mjs
node scripts/s2-normal-chat-cross-artifact-contract.mjs
node scripts/s2-t336-refresh-chat-after-dice-product-seal.mjs --check
node scripts/s2-t336-chat-after-dice-product-contract.mjs
node scripts/s2-t336-chat-after-dice-emulator.mjs
node scripts/s2-t336-chat-readiness.mjs
