#!/bin/sh
set -eu

pnpm exec tsc -p apps/mobile/tsconfig.normal-chat-ai-candidate-test.json
node .tmp/normal-chat-ai-candidate-tests/apps/mobile/src/services/normalChatAiCandidate.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.normal-chat-ai-candidate-test.json
node .tmp/normal-chat-ai-candidate-tests/supabase/functions/_shared/normal-chat-ai-candidate-v1.fixtures.js
node scripts/s2-normal-chat-contract.mjs
node scripts/s2-normal-chat-cross-artifact-contract.mjs
node scripts/s2-normal-chat-offline-harness.mjs
node scripts/s2-t306-chat-integration-candidate-contract.mjs
