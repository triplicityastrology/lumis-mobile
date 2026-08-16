#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const route = read("apps/mobile/src/features/dice/CustomerDiceRitualRoute.tsx");
const screen = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const founder = read("apps/mobile/src/dev/FounderLiveMobileDiceRoute.tsx");
const gateway = read("apps/mobile/src/services/diceFounderFreeTextGateway.ts");
const transport = read("apps/mobile/src/services/diceFounderFreeTextTransport.ts");
const fixtureGateway = read("apps/mobile/src/services/diceMobileLiveGateway.ts");

assert.match(founder, /<CustomerDiceRitualRoute[\s\S]*founderLiveFreeText/);
assert.match(route, /founderLiveFreeText[\s\S]*createDiceFounderFreeTextController/);
assert.match(route, /requireClosedFixtureRegistry=\{!props\.founderLiveFreeText\}/);
assert.match(gateway, /classifyDiceQuestionRequest\(\{ question: input\.question \}\)/);
assert.match(gateway, /question: decision\.normalized_question[\s\S]*planet_id: input\.planet_id[\s\S]*sign_id: input\.sign_id[\s\S]*house_id: input\.house_id/);
assert.match(gateway, /founder_free_text_enabled[\s\S]*authority_sha256[\s\S]*accepted_authority_sha256/);
assert.match(gateway, /acceptedAuthority[\s\S]*\^\[0-9a-f\]\{64\}\$/);
assert.doesNotMatch(gateway, /resolveDiceFounderFixture|fixture_id/);
assert.match(transport, /\/dice-free-text/);
assert.match(transport, /x-lumis-mobile-dice-session/);
assert.match(transport, /privateHost/);
assert.doesNotMatch(transport, /AZURE|SUPABASE|api[_-]?key|service[_-]?role|secret/iu);

assert.match(screen, /ChatThinkingIndicator/);
assert.match(screen, /accessibilityLabel="Lumis is reading your throw"/);
assert.match(screen, /nestedScrollEnabled showsVerticalScrollIndicator/);
assert.match(screen, /label="Roll again"/);
assert.match(screen, /label="Reflect in Chat"/);
assert.match(screen, /buildReflectionPrompt\(activeQuestion, symbols, currentInterpretation\)/);
assert.match(screen, /planet_id: lastThrowRef\.current\.planetKey/);
assert.match(screen, /sign_id: lastThrowRef\.current\.signKey/);
assert.match(screen, /house_id: lastThrowRef\.current\.houseKey/);

assert.match(fixtureGateway, /resolveDiceFounderFixtureByExactText/);
assert.match(fixtureGateway, /fixture_id: fixture\.fixture_id/);
assert.match(fixtureGateway, /acceptedLiveEvidence/);

console.log("T357 mobile Dice free-text boundary contract passed");
