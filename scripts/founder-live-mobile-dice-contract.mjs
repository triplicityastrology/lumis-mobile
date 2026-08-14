#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const gateway = read("apps/mobile/src/services/diceMobileLiveGateway.ts");
const transport = read("apps/mobile/src/services/diceMobileSupabaseTransport.ts");
const route = read("apps/mobile/src/features/dice/CustomerDiceRitualRoute.tsx");
const screen = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const launcher = read("scripts/start-founder-live-mobile-dice-ssd.sh");

assert.match(gateway, /ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256: string \| null = null/);
assert.match(gateway, /f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612/);
assert.match(gateway, /lumis_dice_v0_3_prompt_v2/);
assert.match(gateway, /lumis_dice_v0_3_result_v2/);
assert.match(gateway, /fixture_id: fixture\.fixture_id[\s\S]*planet_id: input\.planet_id[\s\S]*sign_id: input\.sign_id[\s\S]*house_id: input\.house_id/);
assert.doesNotMatch(gateway, /AZURE_|api[_-]?key|service[_-]?role|raw[_-]?(?:prompt|response|provider)/i);
assert.match(transport, /client\.functions\.invoke\("dice-synthetic", \{ body \}\)/);
assert.doesNotMatch(transport, /question|planet_layer|provider|azure|secret/i);
assert.match(route, /createDiceMobileLiveController/);
assert.match(route, /createDiceMobileSupabaseTransport/);
assert.match(screen, /planet_id: lastThrowRef\.current\.planetKey/);
assert.match(screen, /sign_id: lastThrowRef\.current\.signKey/);
assert.match(screen, /house_id: lastThrowRef\.current\.houseKey/);
assert.match(screen, /label="Roll again"/);
assert.match(screen, /label="Reflect in Chat"/);
assert.match(screen, /nestedScrollEnabled showsVerticalScrollIndicator/);
assert.match(launcher, /security find-generic-password -w -s lumis-supabase-anon-key/);
assert.match(launcher, /pnpm --dir apps\/mobile exec expo/);
assert.doesNotMatch(launcher, /echo \$ANON_KEY|printf[^\n]*ANON_KEY|set -x|EXPO_PUBLIC_SUPABASE_URL=\s*$/);

console.log("Founder Mobile Dice live boundary contract passed");
