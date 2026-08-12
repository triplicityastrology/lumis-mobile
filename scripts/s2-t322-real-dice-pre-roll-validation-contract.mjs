#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateT322Package } from "./lib/s2-t322-real-dice-pre-roll-validation.mjs";

const { control } = validateT322Package();
const screen = readFileSync("apps/mobile/src/features/dice/DiceRitualScreen.tsx", "utf8");
const gate = readFileSync("apps/mobile/src/features/dice/dicePreRollValidation.ts", "utf8");
const registry = readFileSync("apps/mobile/src/services/diceFounderFixtureRegistry.ts", "utf8");
const workbench = readFileSync("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx", "utf8");

const beginReady = screen.slice(screen.indexOf("const beginReady"), screen.indexOf("const performThrow"));
const gateIndex = beginReady.indexOf("validateDicePreRollQuestion");
assert(gateIndex >= 0, "actual beginReady must invoke deterministic validation");
for (const sideEffect of ["activeQuestionRef.current =", "transition(\"READY\")", "cradleTick()", "Accelerometer.isAvailableAsync"]) {
  assert(beginReady.indexOf(sideEffect) > gateIndex, `${sideEffect} must occur after accepted validation`);
}
assert.match(beginReady, /if \(!decision\.accepted\)[\s\S]*return;/);
assert.match(screen, /validationFeedback\?\.revision === questionRevisionRef\.current/);
assert.match(screen, /accessibilityLiveRegion="assertive"/);
assert.match(screen, /onChangeText=\{\(text\) => \{[\s\S]{0,180}questionRevisionRef\.current \+= 1;[\s\S]{0,180}setValidationFeedback\(null\)/);
for (const invariant of ["Astrology Dice", "YOUR QUESTION", "Shake to mix, then flick up to throw", "Roll again", "Reflect in Chat", "DiceInterpretationCard", "DIE_ORDER.map"]) {
  assert(screen.includes(invariant), `protected visual/behavior invariant missing: ${invariant}`);
}
assert.match(gate, /classifyDiceQuestionRequest/);
assert.match(gate, /resolveDiceFounderFixture/);
assert.match(gate, /fixture\.exact_text !== decision\.normalized_question/);
assert.match(gate, /DICE_FOUNDER_FIXTURE_REGISTRY_SHA256/);
assert.match(registry, /authoring_id: "ZH08"/);
assert.match(registry, /authoring_id: "ZH09"/);
assert.doesNotMatch(registry, /authoring_id: "ZH04"/);
assert.match(workbench, /founderFixture=\{selectedFixture/);
assert.deepEqual(control.rejection_effects, {
  animation_starts: 0,
  random_results_generated: 0,
  ai_clients_constructed: 0,
  transport_calls: 0,
  history_writes: 0,
  session_writes: 0,
  persistence_writes: 0,
  units_charged: 0,
  navigation_actions: 0
});
assert.equal(control.registry.english, 20);
assert.equal(control.registry.zh_hant, 20);
assert.equal(control.registry.excluded_authoring_id, "ZH04");
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.remote_calls, 0);
console.log("S2-T322 real Dice pre-roll source contract passed");
