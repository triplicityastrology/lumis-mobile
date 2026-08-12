import assert from "node:assert/strict";

import {
  CHAT_POST_DICE_SERVER_ENABLED,
  CHAT_POST_DICE_SERVER_TRAFFIC_ENABLED,
  handleChatPostDiceReleaseCandidate,
  validateClosedEvidence,
  type ChatPostDiceDependencies,
} from "./chat-post-dice-release-candidate-v1.ts";

const sha = (value: unknown) => JSON.stringify(value).length.toString(16).padStart(64, "0");
const diceEvidence = {
  schema: "s2_t317_dice_technical_80_accepted_evidence_v1",
  decision: "accepted",
  source_commit: "8706db6cadbbf4ae0a58d10a194479a0c7aca465",
  source_tree: "edf01652aa245cc1bc202f3e3cee677b074a2565",
  release_package_sha256: "690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075",
  release_manifest_sha256: "1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84",
  registry_sha256: "c".repeat(64),
  technical_case_count: 80,
  language_counts: { en: 40, zh_hant: 40 },
  post_window_disabled: true,
  provider_enabled_after: false,
  raw_content_retained: false,
  member_data_used: false,
  persistence_writes: 0,
  units_charged: 0,
};
const deploymentReceipt = {
  schema: "s2_t321_chat_default_off_deployment_receipt_v1",
  decision: "accepted",
  package_sha256: "d".repeat(64),
  function: "chat-synthetic",
  provider_enabled: false,
  normal_chat_unchanged: true,
  disabled_probes: Array(4).fill("CHAT_AI_DISABLED"),
  provider_calls: 0,
  model_invocations: 0,
  rollback_revision: "prior-disabled-revision",
};
const trafficReceipt = {
  schema: "s2_t321_chat_synthetic_traffic_authorization_v1",
  decision: "accepted",
  package_sha256: "d".repeat(64),
  accepted_dice_evidence_sha256: sha(diceEvidence),
  scope: "SYNTHETIC_CHAT_FIXTURE_IDS_ONLY",
  fixture_count: 2,
  language_counts: { en: 1, zh_hant: 1 },
  single_use: true,
  valid_until: "2099-01-01T00:00:00Z",
};

let authReads = 0;
let providerConstructions = 0;
const dependencies: ChatPostDiceDependencies = {
  controls: {
    acceptedT317SourceCommit: diceEvidence.source_commit,
    acceptedT317SourceTree: diceEvidence.source_tree,
    acceptedT317ReleasePackageSha256: diceEvidence.release_package_sha256,
    acceptedT317ReleaseManifestSha256: diceEvidence.release_manifest_sha256,
    acceptedDiceEvidenceSha256: sha(diceEvidence),
    acceptedDeploymentReceiptSha256: sha(deploymentReceipt),
    acceptedTrafficReceiptSha256: sha(trafficReceipt),
  },
  diceEvidence,
  deploymentReceipt,
  trafficReceipt,
  sha256Canonical: sha,
  release: {
    controls: { acceptedDiceEvidenceSha256: null, acceptedDeploymentReceiptSha256: null, acceptedTrafficReceiptSha256: null },
    diceEvidence: null,
    deploymentReceipt: null,
    trafficReceipt: null,
    sha256Canonical: sha,
    nextClientTurnId: () => "123e4567-e89b-42d3-a456-426614174000",
    candidate: {
      control: { integrationEnabled: true, trafficEnabled: true, acceptedDiceEvidenceSha256: "a".repeat(64), acceptedChatAuthoritySha256: "b".repeat(64) },
      diceEvidence: {}, independentlyComputedDiceEvidenceSha256: "a".repeat(64),
      resolveAuthenticatedActor: async () => { authReads += 1; return { actorId: "forbidden" }; },
      hasActiveProfile: async () => true,
      inspectPolicy: () => ({ kind: "allowed", unitsToCharge: 1 }),
      findCommittedReplay: async () => null,
      createProviderClient: () => { providerConstructions += 1; throw new Error("forbidden"); },
      commitAtomicSuccess: async () => null,
      nextRequestId: () => "request_disabled",
      nowMs: () => 0,
      recordMetadata: () => undefined,
    },
  },
};

assert.equal(CHAT_POST_DICE_SERVER_ENABLED, false);
assert.equal(CHAT_POST_DICE_SERVER_TRAFFIC_ENABLED, false);
assert.equal(validateClosedEvidence(dependencies), true);
assert.equal(validateClosedEvidence({ ...dependencies, controls: { ...dependencies.controls, acceptedT317SourceCommit: null } }), false);
assert.equal(validateClosedEvidence({ ...dependencies, diceEvidence: { ...diceEvidence, source_tree: "a".repeat(40) } }), false);
assert.equal(validateClosedEvidence({ ...dependencies, diceEvidence: { ...diceEvidence, technical_case_count: 79 } }), false);

async function main() {
  const response = await handleChatPostDiceReleaseCandidate(
    { schema_version: "chat_release_candidate_mobile_v1", fixture_id: "chat-en-reflection-01" },
    dependencies,
  );
  assert.equal(response.result, "technical_error");
  assert.equal(response.error_code, "NORMAL_CHAT_AI_DISABLED");
  assert.equal(response.persistence, "not_committed");
  assert.equal(response.units_charged, 0);
  assert.equal(authReads, 0);
  assert.equal(providerConstructions, 0);
  console.log("S2_T321_CHAT_POST_DICE_SERVER_FIXTURES_OK");
}

void main();
