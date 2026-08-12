import assert from "node:assert/strict";

import {
  CHAT_POST_DICE_INTEGRATION_ENABLED,
  CHAT_POST_DICE_TRAFFIC_ENABLED,
  T317_FINAL_MANIFEST_SHA256,
  T317_FINAL_PACKAGE_SHA256,
  T317_FINAL_SOURCE_COMMIT,
  T317_FINAL_SOURCE_TREE,
  buildExplicitDiceReflectHandoff,
  invokeChatPostDiceReleaseCandidate,
  validateAcceptedT317DiceEvidence,
  type T317DiceEvidenceBinding,
} from "./chatPostDiceReleaseCandidate";

const binding: T317DiceEvidenceBinding = {
  source_commit: T317_FINAL_SOURCE_COMMIT,
  source_tree: T317_FINAL_SOURCE_TREE,
  release_package_sha256: T317_FINAL_PACKAGE_SHA256,
  release_manifest_sha256: T317_FINAL_MANIFEST_SHA256,
  evidence_sha256: "c".repeat(64),
};
const evidence = {
  schema: "s2_t317_dice_technical_80_accepted_evidence_v1",
  decision: "accepted",
  source_commit: binding.source_commit,
  source_tree: binding.source_tree,
  release_package_sha256: binding.release_package_sha256,
  release_manifest_sha256: binding.release_manifest_sha256,
  registry_sha256: "d".repeat(64),
  technical_case_count: 80,
  language_counts: { en: 40, zh_hant: 40 },
  post_window_disabled: true,
  provider_enabled_after: false,
  raw_content_retained: false,
  member_data_used: false,
  persistence_writes: 0,
  units_charged: 0,
};

assert.equal(CHAT_POST_DICE_INTEGRATION_ENABLED, false);
assert.equal(CHAT_POST_DICE_TRAFFIC_ENABLED, false);
assert.equal(validateAcceptedT317DiceEvidence(evidence, binding), true);
assert.equal(validateAcceptedT317DiceEvidence({ ...evidence, technical_case_count: 79 }, binding), false);
assert.equal(validateAcceptedT317DiceEvidence(evidence, { ...binding, source_commit: null }), false);
assert.equal(validateAcceptedT317DiceEvidence({ ...evidence, source_tree: "a".repeat(40) }, binding), false);
assert.equal(validateAcceptedT317DiceEvidence({ ...evidence, release_manifest_sha256: "b".repeat(64) }, binding), false);

const draft = "Help me reflect on my astrology dice throw. My question was: “How did my interview go?” The dice showed Venus, Leo, 6th House. The Dice interpretation was: Reading: Notice what became clearer. Watch out: Avoid overconfidence. Practical direction: Write down one reversible next step.";
assert.deepEqual(buildExplicitDiceReflectHandoff({ action: "reflect_in_chat", chat_draft: draft }), {
  target: "chat",
  chat_draft: draft,
  provenance: "explicit_reflect_in_chat",
  dice_context: {
    question: "How did my interview go?",
    results: ["Venus", "Leo", "6th House"],
    interpretation: "Reading: Notice what became clearer. Watch out: Avoid overconfidence. Practical direction: Write down one reversible next step.",
  },
});
assert.throws(() => buildExplicitDiceReflectHandoff({ chat_draft: draft }), /EXPLICIT_ACTION/);
assert.throws(() => buildExplicitDiceReflectHandoff({ action: "automatic", chat_draft: draft }), /EXPLICIT_ACTION/);
assert.throws(() => buildExplicitDiceReflectHandoff({ action: "reflect_in_chat", chat_draft: "Help me reflect on my astrology dice throw." }), /HANDOFF_INVALID/);
assert.throws(() => buildExplicitDiceReflectHandoff({ action: "reflect_in_chat", chat_draft: draft, endpoint: "forbidden" }), /CLOSED_INPUT/);

async function main() {
  let transports = 0;
  await assert.rejects(
    invokeChatPostDiceReleaseCandidate({
      fixture_id: "chat-en-reflection-01",
      dice_evidence: evidence,
      binding,
      create_transport: () => {
        transports += 1;
        return { invoke: async () => ({}) };
      },
    }),
    /CHAT_POST_DICE_RELEASE_DISABLED/,
  );
  assert.equal(transports, 0);
  console.log("S2_T321_CHAT_POST_DICE_MOBILE_FIXTURES_OK");
}

void main();
