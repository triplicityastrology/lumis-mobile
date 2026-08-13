// @ts-expect-error The fixture runs in Node; this repo does not pin @types/node.
import assert from "node:assert/strict";

import {
  CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED,
  CHAT_AFTER_DICE_PRODUCT_TRAFFIC_ENABLED,
  buildExplicitReflectPayload,
  createOneCallLatch,
  invokeChatAfterDiceProductCandidate,
  projectChatAfterDiceProductState,
  validateIndependentlyAcceptedFinalDiceEvidence,
} from "./chatAfterDiceProductCandidate";
import { T317_FINAL_RELEASE_SOURCE, T322_PRE_ROLL_SOURCE } from "./chatAfterDiceRoot";
import { T240_FIXED_FALLBACK, T240_SAFETY_REDIRECT } from "./normalChatAiCandidate";

const acceptedSha = "a".repeat(64);
const controls = {
  accepted_final_dice_evidence_sha256: acceptedSha,
  final_dice_binding: {
    accepted_evidence_sha256: acceptedSha,
    t317_independent_review_sha256: "b".repeat(64),
    t322_reseal_and_review_sha256: "c".repeat(64),
  },
};
const evidence = {
  schema: "s2_t331_corrected_dice_evidence_acceptance_v1",
  decision: "accepted",
  t317_source: T317_FINAL_RELEASE_SOURCE,
  t322_source: T322_PRE_ROLL_SOURCE,
  t317_independent_review_sha256: controls.final_dice_binding.t317_independent_review_sha256,
  t322_reseal_and_review_sha256: controls.final_dice_binding.t322_reseal_and_review_sha256,
  normal_chat_unchanged: true,
  reflect_handoff: "explicit_reflect_in_chat",
  post_validation_disabled: true,
};
const payload = {
  action: "reflect_in_chat",
  question: "What should I notice?",
  results: ["Venus", "Leo", "6th House"],
  interpretation: "Notice what became clearer.",
};

assert.equal(CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED, false);
assert.equal(CHAT_AFTER_DICE_PRODUCT_TRAFFIC_ENABLED, false);
assert.equal(validateIndependentlyAcceptedFinalDiceEvidence(evidence, acceptedSha, controls), true);
assert.equal(validateIndependentlyAcceptedFinalDiceEvidence(evidence, "d".repeat(64), controls), false);
assert.deepEqual(buildExplicitReflectPayload(payload), payload);
assert.throws(() => buildExplicitReflectPayload({ ...payload, action: "automatic" }), /EXPLICIT_ACTION/);
assert.throws(() => buildExplicitReflectPayload({ ...payload, results: ["Venus", "Leo"] }), /EXPLICIT_ACTION/);
assert.throws(() => buildExplicitReflectPayload({ ...payload, chat_draft: "extra" }), /PAYLOAD_INVALID/);

const clientTurnId = "123e4567-e89b-42d3-a456-426614174000";
const base = {
  schema_version: "normal_chat_mobile_response_v1",
  request_id: "request_t336",
  client_turn_id: clientTurnId,
} as const;
const responses = {
  completed: {
    ...base,
    result: "completed",
    thread_id: "223e4567-e89b-42d3-a456-426614174000",
    assistant_message: "Take one reversible step and notice what changes.",
    persistence: "committed",
    idempotency_outcome: "committed",
    units_charged: 1,
    atomic_outcome: { user_message: "committed", assistant_message: "committed", unit_ledger: "committed", idempotency_outcome: "committed" },
  },
  fallback: { ...base, result: "fixed_fallback", assistant_message: T240_FIXED_FALLBACK, error_code: "NORMAL_CHAT_FIXED_FALLBACK", persistence: "not_committed", idempotency_outcome: "not_committed", units_charged: 0 },
  safety: { ...base, result: "safety_rejected", assistant_message: T240_SAFETY_REDIRECT, error_code: "NORMAL_CHAT_SAFETY_REJECTED", persistence: "not_committed", idempotency_outcome: "not_committed", units_charged: 0 },
  technical_error: { ...base, result: "technical_error", error_code: "NORMAL_CHAT_CONFIGURATION_UNAVAILABLE", persistence: "not_committed", idempotency_outcome: "not_committed", units_charged: 0 },
} as const;

for (const language of ["en", "zh-Hant"] as const) {
  const loading = projectChatAfterDiceProductState(language, "loading");
  assert.equal(loading.result, null);
  assert.equal(loading.assistant_message, null);
  for (const phase of ["completed", "fallback", "safety", "technical_error"] as const) {
    const projected = projectChatAfterDiceProductState(language, phase, responses[phase]);
    assert.equal(projected.phase, phase);
    assert.equal(projected.provider_calls, 0);
    assert.equal(projected.persistence_writes, 0);
    assert.equal(projected.units_charged, 0);
  }
  assert.equal(projectChatAfterDiceProductState(language, "fallback", responses.fallback).assistant_message, T240_FIXED_FALLBACK);
  assert.equal(projectChatAfterDiceProductState(language, "safety", responses.safety).assistant_message, T240_SAFETY_REDIRECT);
  assert.equal(projectChatAfterDiceProductState(language, "technical_error", responses.technical_error).assistant_message, null);
}

const latch = createOneCallLatch();
latch.claim();
assert.throws(() => latch.claim(), /DUPLICATE_AI_CALL_BLOCKED/);
assert.equal(latch.calls(), 1);

async function main() {
  let payloadReads = 0;
  let latchClaims = 0;
  let transportConstructions = 0;
  const guardedPayload = new Proxy(payload, { ownKeys(target) { payloadReads += 1; return Reflect.ownKeys(target); } });
  await assert.rejects(invokeChatAfterDiceProductCandidate({
    language: "en",
    controls,
    final_dice_evidence: evidence,
    independently_computed_evidence_sha256: acceptedSha,
    reflect_payload: guardedPayload,
    call_latch: { claim: () => { latchClaims += 1; } },
    create_transport: () => {
      transportConstructions += 1;
      return { invoke: async () => responses.completed };
    },
  }), /CHAT_AFTER_DICE_PRODUCT_DISABLED/);
  assert.equal(payloadReads, 0);
  assert.equal(latchClaims, 0);
  assert.equal(transportConstructions, 0);
  console.log("S2_T336_CHAT_AFTER_DICE_PRODUCT_MOBILE_OK");
}

void main();
