import assert from "node:assert/strict";
import { buildInteractiveDiceFixture, DICE_INACTIVE_FOUNDER_DECISIONS, DICE_INTERPRETATION_FIXTURES, getDiceFixture } from "./diceInterpretationFixture";

assert.deepEqual(DICE_INTERPRETATION_FIXTURES.slice(0, 4).map(({ screen }) => screen), ["question", "question", "question", "question"]);
assert.deepEqual(DICE_INTERPRETATION_FIXTURES.slice(0, 4).map(({ classification }) => classification), ["rejected", "rejected", "safety", "rejected"]);
for (const fixture of DICE_INTERPRETATION_FIXTURES) {
  assert.equal(fixture.evidence.providerCalls, 0);
  assert.equal(fixture.evidence.persistenceWrites, 0);
  assert.equal(fixture.evidence.unitsConsumed, 0);
  assert.doesNotMatch(JSON.stringify(fixture), /email|account_id|birth_data|credential|endpoint|model_id/i);
}
for (const id of ["invalid_hi", "bundled", "safety", "disallowed"]) {
  const fixture = getDiceFixture(id);
  assert.ok(fixture.boundaryMessage);
  assert.equal(fixture.reading, null);
}
for (const id of ["interactive_en", "interactive_zh"]) {
  const fixture = getDiceFixture(id);
  const result = buildInteractiveDiceFixture({ language: fixture.language, question: fixture.question, symbols: fixture.symbols });
  assert.ok(result.reading);
  assert.equal(result.evidence.providerCalls, 0);
}
assert.deepEqual(new Set(Object.values(DICE_INACTIVE_FOUNDER_DECISIONS)), new Set(["inactive_unresolved"]));
assert.equal(getDiceFixture("missing").id, "invalid_hi");
console.log(`S2-T243 Dice Founder fixtures passed (${DICE_INTERPRETATION_FIXTURES.length} states).`);
