import assert from "node:assert/strict";
import {
  CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED,
  CHAT_AFTER_DICE_SERVER_SYNTHETIC_TRAFFIC_ENABLED,
  handleChatAfterDiceRoot,
  type ChatAfterDiceServerDependencies,
} from "./chat-after-dice-root-v1.ts";

async function main() {
  let hashes = 0;
  let providerConstructions = 0;
  const dependencies = {
    controls: {
      acceptedCorrectedDiceEvidenceSha256: null,
      acceptedDefaultOffDeploymentReceiptSha256: null,
      acceptedSyntheticTrafficReceiptSha256: null,
    },
    correctedDiceEvidence: null,
    defaultOffDeploymentReceipt: null,
    syntheticTrafficReceipt: null,
    sha256Canonical: () => { hashes += 1; return "0".repeat(64); },
    productPath: {
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
      sha256Canonical: () => "0".repeat(64),
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
          inspectPolicy: () => ({ kind: "safety" as const }),
          findCommittedReplay: async () => null,
          createProviderClient: () => { providerConstructions += 1; throw new Error("forbidden"); },
          commitAtomicSuccess: async () => null,
          nextRequestId: () => "request_t331",
          nowMs: () => 0,
          recordMetadata: () => undefined,
        },
      },
    },
  } satisfies ChatAfterDiceServerDependencies;
  const response = await handleChatAfterDiceRoot({ forbidden: true }, dependencies);
  assert.equal(CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED, false);
  assert.equal(CHAT_AFTER_DICE_SERVER_SYNTHETIC_TRAFFIC_ENABLED, false);
  assert.equal(response.result, "technical_error");
  assert.equal(response.persistence, "not_committed");
  assert.equal(response.units_charged, 0);
  assert.equal(hashes, 0);
  assert.equal(providerConstructions, 0);
  console.log("S2_T331_CHAT_AFTER_DICE_SERVER_OK");
}

void main();
