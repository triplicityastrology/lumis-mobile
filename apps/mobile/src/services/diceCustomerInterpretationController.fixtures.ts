import assert from "node:assert/strict";

import {
  createDiceCustomerInterpretationController,
  isCurrentDiceCustomerEnvelope,
  parseDiceCustomerFixtureMode,
  type DiceCustomerInterpretationEnvelope,
} from "./diceCustomerInterpretationController";

const EN = Object.freeze({
  request_key: "dice-roll-1",
  question: "What should I do next weekend?",
  planet: "Venus",
  sign: "Leo",
  house: "6th House",
  planet_id: "venus",
  sign_id: "leo",
  house_id: "house_6",
});

async function collect(mode: "disabled" | "completed" | "safety" | "fallback" | "technical_error") {
  const states: DiceCustomerInterpretationEnvelope[] = [];
  await createDiceCustomerInterpretationController(mode).request(EN, (state) => states.push(state));
  return states;
}

async function main() {
  assert.equal(parseDiceCustomerFixtureMode("completed", false), "disabled");
  assert.equal(parseDiceCustomerFixtureMode("completed", true), "completed");
  assert.equal(parseDiceCustomerFixtureMode("live", true), "disabled");

  const disabled = await collect("disabled");
  assert.deepEqual(disabled.map((item) => item.state.kind), ["disabled"]);

  const completed = await collect("completed");
  assert.deepEqual(completed.map((item) => item.state.kind), ["loading", "interpretation"]);
  assert.deepEqual(completed[1]?.state.effects, { provider_calls: 0, persistence_writes: 0, units_charged: 0 });

  for (const [mode, expected] of [
    ["safety", "safety"],
    ["fallback", "fallback"],
    ["technical_error", "retry"],
  ] as const) {
    const states = await collect(mode);
    assert.deepEqual(states.map((item) => item.state.kind), ["loading", expected]);
  }

  const hostile: DiceCustomerInterpretationEnvelope[] = [];
  await createDiceCustomerInterpretationController("completed").request(
    { ...EN, request_key: "dice-roll-2", question: "Unlisted question" },
    (state) => hostile.push(state),
  );
  assert.deepEqual(hostile.map((item) => item.state.kind), ["retry"]);
  assert.equal(hostile[0]?.state.kind === "retry" ? hostile[0].state.code : null, "DICE_FIXTURE_ID_INVALID");

  assert.equal(isCurrentDiceCustomerEnvelope("dice-roll-2", hostile[0]!), true);
  assert.equal(isCurrentDiceCustomerEnvelope("dice-roll-3", hostile[0]!), false);
  assert.equal(isCurrentDiceCustomerEnvelope(null, hostile[0]!), false);

  console.log("S2-T337 customer Dice interpretation controller fixtures passed");
}

void main();
