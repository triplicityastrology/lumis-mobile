#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsc -p apps/mobile/tsconfig.founder-live-chat-test.json
node .tmp/founder-live-chat-tests/apps/mobile/src/services/founderLiveChat.fixtures.js
pnpm exec tsc -p supabase/functions/tsconfig.founder-chat-window-test.json
node .tmp/founder-chat-window-tests/supabase/functions/_shared/founder-chat-window-v1.fixtures.js
node scripts/founder-live-chat-contract.mjs
node scripts/refresh-founder-live-chat-seal.mjs --check
bash -n scripts/start-founder-live-chat.sh
