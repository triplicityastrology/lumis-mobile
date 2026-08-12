import assert from "node:assert/strict";

import {
  CHAT_AFTER_DICE_DEPLOYMENT_ENABLED,
  CHAT_AFTER_DICE_SYNTHETIC_TRAFFIC_ENABLED,
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  T317_FINAL_RELEASE_SOURCE,
  T322_PRE_ROLL_SOURCE,
  buildExplicitChatAfterDiceHandoff,
  invokeChatAfterDiceRoot,
  projectDisabledChatState,
  validateCorrectedDiceEvidence,
} from "./chatAfterDiceRoot";

const binding = {
  accepted_evidence_sha256: "a".repeat(64),
  t317_independent_review_sha256: "b".repeat(64),
  t322_reseal_and_review_sha256: "c".repeat(64),
};
const evidence = {
  schema: "s2_t331_corrected_dice_evidence_acceptance_v1",
  decision: "accepted",
  t317_source: T317_FINAL_RELEASE_SOURCE,
  t322_source: T322_PRE_ROLL_SOURCE,
  t317_independent_review_sha256: binding.t317_independent_review_sha256,
  t322_reseal_and_review_sha256: binding.t322_reseal_and_review_sha256,
  normal_chat_unchanged: true,
  reflect_handoff: "explicit_reflect_in_chat",
  post_validation_disabled: true,
};

assert.equal(CHAT_AFTER_DICE_DEPLOYMENT_ENABLED, false);
assert.equal(CHAT_AFTER_DICE_SYNTHETIC_TRAFFIC_ENABLED, false);
assert.equal(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(NO_AZURE_TRAFFIC_AUTHORITY, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(validateCorrectedDiceEvidence(evidence, binding), true);
assert.equal(validateCorrectedDiceEvidence({ ...evidence, decision: "source_complete" }, binding), false);
assert.equal(validateCorrectedDiceEvidence(evidence, { ...binding, t322_reseal_and_review_sha256: null }), false);

for (const language of ["en", "zh-Hant"] as const) {
  for (const phase of ["loading", "result", "safety", "fallback", "retry"] as const) {
    assert.deepEqual(projectDisabledChatState(language, phase), {
      language,
      phase,
      assistant_message: projectDisabledChatState(language, phase).assistant_message,
      live: false,
      provider_calls: 0,
      persistence_writes: 0,
      units_charged: 0,
    });
  }
}

const draft = "Help me reflect on my astrology dice throw. My question was: “What should I notice?” The dice showed Venus, Leo, 6th House. The Dice interpretation was: Notice what became clearer.";
assert.equal(buildExplicitChatAfterDiceHandoff({ action: "reflect_in_chat", chat_draft: draft }).provenance, "explicit_reflect_in_chat");
assert.throws(() => buildExplicitChatAfterDiceHandoff({ action: "automatic", chat_draft: draft }), /EXPLICIT_ACTION/);

async function main() {
  let transportConstructions = 0;
  await assert.rejects(invokeChatAfterDiceRoot({
    language: "zh-Hant",
    controls: {
      corrected_dice: binding,
      default_off_deployment_receipt_sha256: null,
      synthetic_traffic_receipt_sha256: null,
    },
    corrected_dice_evidence: evidence,
    handoff: { action: "reflect_in_chat", chat_draft: draft },
    create_transport: () => {
      transportConstructions += 1;
      return { invoke: async () => ({}) };
    },
  }), /CHAT_AFTER_DICE_DISABLED/);
  assert.equal(transportConstructions, 0);
  console.log("S2_T331_CHAT_AFTER_DICE_MOBILE_OK");
}

void main();
