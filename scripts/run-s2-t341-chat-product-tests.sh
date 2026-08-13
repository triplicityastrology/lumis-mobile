#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.chat-product-integration-rc-test.json
node .tmp/chat-product-integration-rc-tests/apps/mobile/src/services/chatProductIntegrationRc.fixtures.js
node scripts/s2-normal-chat-contract.mjs
node scripts/s2-normal-chat-cross-artifact-contract.mjs
node scripts/s2-normal-chat-offline-harness.mjs
node scripts/s2-t341-refresh-chat-product-seal.mjs --check
node scripts/s2-t341-chat-product-contract.mjs
bash -n scripts/start-s2-t341-chat-product.sh
