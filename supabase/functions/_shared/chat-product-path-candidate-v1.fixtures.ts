import assert from "node:assert/strict";
import {
  CHAT_PRODUCT_PATH_SERVER_ENABLED,
  CHAT_PRODUCT_PATH_SERVER_TRAFFIC_ENABLED,
  handleChatProductPathCandidate,
} from "./chat-product-path-candidate-v1.ts";

async function main(): Promise<void> {
  let evidenceHashes = 0;
  let providerConstructions = 0;
  const response = await handleChatProductPathCandidate({ prompt: "forbidden" }, {
    controls: {
      acceptedT317SourceCommit: null,
      acceptedT317SourceTree: null,
      acceptedT317ReleasePackageSha256: null,
      acceptedT317ReleaseManifestSha256: null,
      acceptedDiceEvidenceSha256: null,
      acceptedDeploymentReceiptSha256: null,
      acceptedTrafficReceiptSha256: null,
    },
    diceEvidence: null,
    deploymentReceipt: null,
    trafficReceipt: null,
    sha256Canonical: () => { evidenceHashes += 1; return "0".repeat(64); },
    release: {
      controls: { acceptedDiceEvidenceSha256: null, acceptedDeploymentReceiptSha256: null, acceptedTrafficReceiptSha256: null },
      diceEvidence: null,
      deploymentReceipt: null,
      trafficReceipt: null,
      sha256Canonical: () => "0".repeat(64),
      nextClientTurnId: () => "123e4567-e89b-42d3-a456-426614174000",
      candidate: {
        control: { integrationEnabled: false, trafficEnabled: false, acceptedDiceEvidenceSha256: null, acceptedChatAuthoritySha256: null },
        diceEvidence: null,
        independentlyComputedDiceEvidenceSha256: "0".repeat(64),
        resolveAuthenticatedActor: async () => { throw new Error("forbidden"); },
        hasActiveProfile: async () => false,
        inspectPolicy: () => ({ kind: "safety" }),
        findCommittedReplay: async () => null,
        createProviderClient: () => { providerConstructions += 1; throw new Error("forbidden"); },
        commitAtomicSuccess: async () => null,
        nextRequestId: () => "request_t326",
        nowMs: () => 0,
        recordMetadata: () => undefined,
      },
    },
  });
  assert.equal(CHAT_PRODUCT_PATH_SERVER_ENABLED, false);
  assert.equal(CHAT_PRODUCT_PATH_SERVER_TRAFFIC_ENABLED, false);
  assert.equal(response.result, "technical_error");
  assert.equal(response.persistence, "not_committed");
  assert.equal(response.units_charged, 0);
  assert.equal(evidenceHashes, 0);
  assert.equal(providerConstructions, 0);
  console.log("S2_T326_CHAT_PRODUCT_PATH_SERVER_OK");
}

void main();
