#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.normal-chat-ai-candidate-test.json
node .tmp/normal-chat-ai-candidate-tests/apps/mobile/src/services/normalChatAiCandidate.fixtures.js
pnpm exec tsc -p apps/mobile/tsconfig.chat-release-candidate-test.json
node .tmp/chat-release-candidate-tests/apps/mobile/src/services/chatReleaseCandidate.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.normal-chat-ai-candidate-test.json
node .tmp/normal-chat-ai-candidate-tests/supabase/functions/_shared/normal-chat-ai-candidate-v1.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.normal-chat-release-candidate-test.json
node .tmp/normal-chat-release-candidate-tests/supabase/functions/_shared/normal-chat-release-candidate-v1.fixtures.js
pnpm exec tsc -p apps/mobile/tsconfig.founder-companion-chat-window-test.json
node .tmp/founder-companion-chat-window-tests/apps/mobile/src/dev/founderPolishedChatContract.fixtures.js
node scripts/s2-normal-chat-cross-artifact-contract.mjs
node scripts/s2-t311-chat-release-candidate-contract.mjs
node scripts/s2-t311-refresh-chat-release-seal.mjs --check
node scripts/s2-t311-chat-readiness.mjs
