#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const gateway = read("apps/mobile/src/services/diceMobileLiveGateway.ts");
const transport = read("apps/mobile/src/services/diceMobileSupabaseTransport.ts");
const route = read("apps/mobile/src/features/dice/CustomerDiceRitualRoute.tsx");
const screen = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const launcher = read("scripts/start-founder-live-mobile-dice-ssd.sh");
const index = read("apps/mobile/index.ts");
const expectedScreenSha256 = "bbf1f6ccc9ca18a550904acb10a642fc15d78bd920e6777438aa87e446df816a";

assert.match(gateway, /EXPO_PUBLIC_DICE_ACCEPTED_FOUNDER_WINDOW_EVIDENCE_SHA256/);
assert.match(gateway, /f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612/);
assert.match(gateway, /lumis_dice_v0_3_prompt_v2/);
assert.match(gateway, /lumis_dice_v0_3_result_v2/);
assert.match(gateway, /fixture_id: fixture\.fixture_id[\s\S]*planet_id: input\.planet_id[\s\S]*sign_id: input\.sign_id[\s\S]*house_id: input\.house_id/);
assert.doesNotMatch(gateway, /AZURE_|api[_-]?key|service[_-]?role|raw[_-]?(?:prompt|response|provider)/i);
assert.match(transport, /EXPO_PUBLIC_DICE_MOBILE_RELAY_URL/);
assert.match(transport, /x-lumis-mobile-dice-session/);
assert.match(transport, /privateHost/);
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
assert.match(launcher, /security find-generic-password -w -s lumis-founder-public-key-path/);
assert.match(launcher, /founder-mobile-dice-relay\.mjs/);
assert.match(launcher, /S2-T348-Founder-Web-Lab-Live-be92814\/founder-window-receipt\.json/);
assert.match(launcher, /FOUNDER_LIVE_MOBILE_DICE_PORT:-8230/);
assert.match(launcher, /FOUNDER_LIVE_MOBILE_DICE_RELAY_PORT:-8231/);
assert.match(launcher, /codex\/s2-t349-mobile-dice-live-candidate/);
assert.match(launcher, /pnpm --dir apps\/mobile exec expo/);
assert.doesNotMatch(launcher, /echo \$ANON_KEY|printf[^\n]*ANON_KEY|set -x|EXPO_PUBLIC_SUPABASE_URL=\s*$/);
assert.match(index, /FOUNDER_LIVE_MOBILE_DICE_ENABLED[\s\S]*FounderLiveMobileDiceRoute/);
assert.equal(createHash("sha256").update(screen).digest("hex"), expectedScreenSha256, "signed Dice result-card source changed");

console.log("Founder Mobile Dice live boundary contract passed");
