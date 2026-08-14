import assert from "node:assert/strict";

import { DICE_FOUNDER_FIXTURE_REGISTRY_SHA256 } from "./diceFounderFixtureRegistry";
import {
  DICE_MICROSOFT_CONTRACT_COMMIT,
  DICE_MICROSOFT_CONTRACT_SEAL_SHA256,
  DICE_PROMPT_VERSION,
  DICE_RESULT_SCHEMA,
  DICE_RUNTIME_PACKAGE_SHA256,
  DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256,
  acceptedLiveEvidence,
  createDiceMobileLiveController,
  type DiceMobileLiveEvidence,
} from "./diceMobileLiveGateway";
import type { DiceCustomerInterpretationEnvelope, DiceCustomerInterpretationInput } from "./diceCustomerInterpretationController";

const FOUNDER_RECEIPT = "a".repeat(64);
const evidence: DiceMobileLiveEvidence = Object.freeze({
  schema: "lumis_dice_founder_mobile_live_evidence_v1",
  status: "accepted",
  technical_80_metadata_receipt_sha256: DICE_TECHNICAL_80_METADATA_RECEIPT_SHA256,
  runtime_package_sha256: DICE_RUNTIME_PACKAGE_SHA256,
  microsoft_contract_commit: DICE_MICROSOFT_CONTRACT_COMMIT,
  microsoft_contract_seal_sha256: DICE_MICROSOFT_CONTRACT_SEAL_SHA256,
  prompt_version: DICE_PROMPT_VERSION,
  result_schema: DICE_RESULT_SCHEMA,
  founder_window_evidence_sha256: FOUNDER_RECEIPT,
  fixture_registry_sha256: DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
});
const input: DiceCustomerInterpretationInput = Object.freeze({
  request_key: "dice-live-1",
  question: "How did my interview go?",
  planet: "Venus",
  sign: "Leo",
  house: "6th House",
  planet_id: "venus",
  sign_id: "leo",
  house_id: "house_6",
});

async function collect(config: Parameters<typeof createDiceMobileLiveController>[0], value = input) {
  const states: DiceCustomerInterpretationEnvelope[] = [];
  await createDiceMobileLiveController(config).request(value, (state) => states.push(state));
  return states;
}

async function main() {
  assert.equal(acceptedLiveEvidence(evidence), false, "production has no accepted Founder receipt pinned");
  assert.equal(acceptedLiveEvidence(evidence, FOUNDER_RECEIPT), true, "an exact reviewed digest is accepted");
  assert.equal(acceptedLiveEvidence({ ...evidence, founder_window_evidence_sha256: "b".repeat(64) }, FOUNDER_RECEIPT), false);

  let constructions = 0;
  let calls = 0;
  const transport = () => {
    constructions += 1;
    return async (request: Record<string, unknown>) => {
      calls += 1;
      assert.deepEqual(Object.keys(request).sort(), ["fixture_id", "house_id", "planet_id", "sign_id"]);
      assert.deepEqual(request, { fixture_id: "dice-founder-en-10", planet_id: "venus", sign_id: "leo", house_id: "house_6" });
      return {
        schema: "lumis_dice_v0_3_result_v2",
        language: "en",
        planet_layer: "Venus centres relationship and value.",
        sign_element_layer: "Leo makes the expression visible and warm.",
        house_layer: "The 6th House locates this in work and practical routines.",
        timing_or_pace: null,
        judgment: null,
        practical_direction: "Write down one concrete follow-up from the interview.",
      };
    };
  };

  for (const config of [
    { ai_enabled: false, traffic_authorized: false, evidence, accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT, create_transport: transport },
    { ai_enabled: true, traffic_authorized: false, evidence, accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT, create_transport: transport },
    { ai_enabled: true, traffic_authorized: true, evidence: null, accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT, create_transport: transport },
  ]) {
    const states = await collect(config);
    assert.equal(states.at(-1)?.state.kind, "disabled");
  }
  assert.equal(constructions, 0);
  assert.equal(calls, 0);

  const invalid = await collect({ ai_enabled: true, traffic_authorized: true, evidence, accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT, create_transport: transport }, { ...input, planet_id: "chiron" });
  assert.equal(invalid.at(-1)?.state.kind, "retry");
  assert.equal(constructions, 0);
  assert.equal(calls, 0);

  const states = await collect({ ai_enabled: true, traffic_authorized: true, evidence, accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT, create_transport: transport });
  assert.deepEqual(states.map((item) => item.state.kind), ["loading", "interpretation"]);
  assert.equal(constructions, 1);
  assert.equal(calls, 1);

  const hostile = await collect({
    ai_enabled: true,
    traffic_authorized: true,
    evidence,
    accepted_founder_window_evidence_sha256: FOUNDER_RECEIPT,
    create_transport: () => async () => ({ ...await transport()({ fixture_id: "dice-founder-en-10", planet_id: "venus", sign_id: "leo", house_id: "house_6" }), raw_provider_response: "forbidden" }),
  });
  assert.equal(hostile.at(-1)?.state.kind, "retry");

  console.log("Mobile Dice live gateway fixtures passed");
}

void main();
