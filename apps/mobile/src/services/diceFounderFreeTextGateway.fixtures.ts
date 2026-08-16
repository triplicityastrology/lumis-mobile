import assert from "node:assert/strict";

import type { DiceCustomerInterpretationEnvelope, DiceCustomerInterpretationInput } from "./diceCustomerInterpretationController";
import {
  acceptedAuthority,
  createDiceFounderFreeTextController,
  type DiceFounderFreeTextConfig,
  type DiceFounderFreeTextRequest,
} from "./diceFounderFreeTextGateway";
import { createDiceFounderFreeTextTransport } from "./diceFounderFreeTextTransport";

const AUTHORITY = "a".repeat(64);
const input: DiceCustomerInterpretationInput = Object.freeze({
  request_key: "dice-founder-free-text-roll-1",
  question: "What should I notice about my current work situation?",
  planet: "Venus",
  sign: "Leo",
  house: "6th House",
  planet_id: "venus",
  sign_id: "leo",
  house_id: "house_6",
});

async function collect(config: DiceFounderFreeTextConfig, value = input) {
  const states: DiceCustomerInterpretationEnvelope[] = [];
  await createDiceFounderFreeTextController(config).request(value, (state) => states.push(state));
  return states;
}

async function main() {
  assert.equal(acceptedAuthority(AUTHORITY, AUTHORITY), true);
  assert.equal(acceptedAuthority(AUTHORITY, "b".repeat(64)), false);
  assert.equal(acceptedAuthority("not-a-digest", "not-a-digest"), false);

  let constructions = 0;
  const requests: DiceFounderFreeTextRequest[] = [];
  const createTransport = () => {
    constructions += 1;
    return async (request: DiceFounderFreeTextRequest) => {
      requests.push(request);
      return {
        schema: "lumis_dice_v0_3_result_v2",
        language: "en",
        planet_layer: "Venus centres relationship and value.",
        sign_element_layer: "Leo makes the expression visible and warm.",
        house_layer: "The 6th House locates this in work and practical routines.",
        timing_or_pace: null,
        judgment: null,
        practical_direction: "Write down one concrete action you can test.",
      };
    };
  };
  const enabled = Object.freeze({
    ai_enabled: true,
    traffic_authorized: true,
    founder_free_text_enabled: true,
    authority_sha256: AUTHORITY,
    accepted_authority_sha256: AUTHORITY,
    create_transport: createTransport,
  });

  for (const config of [
    { ...enabled, ai_enabled: false },
    { ...enabled, traffic_authorized: false },
    { ...enabled, founder_free_text_enabled: false },
    { ...enabled, authority_sha256: "b".repeat(64) },
  ]) {
    const states = await collect(config);
    assert.equal(states.at(-1)?.state.kind, "disabled");
  }
  assert.equal(constructions, 0, "disabled or unauthorized states construct no transport");

  for (const question of ["hi", "Should I invest in this stock?", "Should I stay and should I leave?"]) {
    const states = await collect(enabled, { ...input, question });
    assert.equal(states.at(-1)?.state.kind, "retry");
  }
  assert.equal(constructions, 0, "deterministic rejection remains pre-transport");

  const first = await collect(enabled);
  assert.deepEqual(first.map((item) => item.state.kind), ["loading", "interpretation"]);
  assert.deepEqual(requests[0], {
    question: input.question,
    planet_id: "venus",
    sign_id: "leo",
    house_id: "house_6",
  });

  const retry = await collect(enabled);
  assert.deepEqual(retry.map((item) => item.state.kind), ["loading", "interpretation"]);
  assert.deepEqual(requests[1], requests[0], "retry sends the current question and the same landed symbols");

  const previousFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_DICE_MOBILE_FREE_TEXT_RELAY_URL = "http://192.168.1.20:8223/dice-free-text";
  process.env.EXPO_PUBLIC_DICE_MOBILE_RELAY_SESSION = "A".repeat(43);
  let relayCalls = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    relayCalls += 1;
    assert.equal(String(url), "http://192.168.1.20:8223/dice-free-text");
    assert.equal((init?.headers as Record<string, string>)["x-lumis-mobile-dice-session"], "A".repeat(43));
    assert.deepEqual(JSON.parse(String(init?.body)), requests[0]);
    return new Response(JSON.stringify({ schema: "lumis_dice_v0_3_result_v2", language: "en" }), { status: 200 });
  }) as typeof fetch;
  await createDiceFounderFreeTextTransport()(requests[0]);
  assert.equal(relayCalls, 1);
  process.env.EXPO_PUBLIC_DICE_MOBILE_FREE_TEXT_RELAY_URL = "https://attacker.invalid/dice-free-text";
  let unsafeRelayRejected = false;
  try {
    createDiceFounderFreeTextTransport();
  } catch (error) {
    unsafeRelayRejected = error instanceof Error && error.message === "DICE_GATEWAY_UNAVAILABLE";
  }
  assert.equal(unsafeRelayRejected, true);
  globalThis.fetch = previousFetch;

  console.log("T357 Founder mobile Dice free-text fixtures passed");
}

void main();
