import assert from "node:assert/strict";

import {
  CHAT_RELEASE_SERVER_ENABLED,
  CHAT_RELEASE_SERVER_TRAFFIC_ENABLED,
  handleChatReleaseCandidate,
} from "./normal-chat-release-candidate-v1.ts";

async function main(): Promise<void> {
  let providerConstructions = 0;
  let authReads = 0;
  const response = await handleChatReleaseCandidate(
  { schema_version: "chat_release_candidate_mobile_v1", fixture_id: "chat-en-reflection-01" },
  {
    controls: {
      acceptedDiceEvidenceSha256: "a".repeat(64),
      acceptedDeploymentReceiptSha256: "b".repeat(64),
      acceptedTrafficReceiptSha256: "c".repeat(64),
    },
    diceEvidence: { schema: "s2_t296_accepted_dice_v4_technical_evidence_v1" },
    deploymentReceipt: { schema: "s2_t311_chat_default_off_deployment_receipt_v1" },
    trafficReceipt: { schema: "s2_t311_chat_synthetic_traffic_authorization_v1" },
    sha256Canonical: () => "f".repeat(64),
    nextClientTurnId: () => "123e4567-e89b-42d3-a456-426614174000",
    candidate: {
      control: { integrationEnabled: true, trafficEnabled: true, acceptedDiceEvidenceSha256: "a".repeat(64), acceptedChatAuthoritySha256: "b".repeat(64) },
      diceEvidence: {},
      independentlyComputedDiceEvidenceSha256: "a".repeat(64),
      resolveAuthenticatedActor: async () => { authReads += 1; return { actorId: "forbidden" }; },
      hasActiveProfile: async () => true,
      inspectPolicy: () => ({ kind: "allowed", unitsToCharge: 1 }),
      findCommittedReplay: async () => null,
      createProviderClient: () => { providerConstructions += 1; throw new Error("provider must not construct"); },
      commitAtomicSuccess: async () => null,
      nextRequestId: () => "request_disabled",
      nowMs: () => 0,
      recordMetadata: () => undefined,
    },
  },
  );

  assert.equal(CHAT_RELEASE_SERVER_ENABLED, false);
  assert.equal(CHAT_RELEASE_SERVER_TRAFFIC_ENABLED, false);
  assert.equal(response.result, "technical_error");
  assert.equal(response.error_code, "NORMAL_CHAT_AI_DISABLED");
  assert.equal(response.units_charged, 0);
  assert.equal(response.persistence, "not_committed");
  assert.equal(response.idempotency_outcome, "not_committed");
  assert.equal(providerConstructions, 0);
  assert.equal(authReads, 0);

  console.log("S2_T311_CHAT_RELEASE_SERVER_FIXTURES_OK");
}

void main();
