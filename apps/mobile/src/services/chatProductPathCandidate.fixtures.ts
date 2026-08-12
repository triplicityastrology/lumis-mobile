import assert from "node:assert/strict";

import {
  CHAT_PRODUCT_PATH_INTEGRATION_ENABLED,
  CHAT_PRODUCT_PATH_TRAFFIC_ENABLED,
  NO_AZURE_TRAFFIC_AUTHORITY,
  NO_NORMAL_CHAT_INTEGRATION_AUTHORITY,
  assertZeroEffectNonSuccess,
  invokeChatProductPath,
  startChatProductPath,
} from "./chatProductPathCandidate";
import { T240_FIXED_FALLBACK, T240_SAFETY_REDIRECT, validateNormalChatCandidateResponse } from "./normalChatAiCandidate";

assert.equal(CHAT_PRODUCT_PATH_INTEGRATION_ENABLED, false);
assert.equal(CHAT_PRODUCT_PATH_TRAFFIC_ENABLED, false);
assert.equal(NO_NORMAL_CHAT_INTEGRATION_AUTHORITY, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(NO_AZURE_TRAFFIC_AUTHORITY, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.deepEqual(startChatProductPath("chat-en-reflection-01"), {
  phase: "loading",
  fixture_id: "chat-en-reflection-01",
});

const base = {
  schema_version: "normal_chat_mobile_response_v1",
  request_id: "request_t326",
  client_turn_id: "123e4567-e89b-42d3-a456-426614174000",
  persistence: "not_committed",
  idempotency_outcome: "not_committed",
  units_charged: 0,
} as const;
for (const response of [
  { ...base, result: "fixed_fallback", assistant_message: T240_FIXED_FALLBACK, error_code: "NORMAL_CHAT_PROVIDER_UNAVAILABLE" },
  { ...base, result: "safety_rejected", assistant_message: T240_SAFETY_REDIRECT, error_code: "NORMAL_CHAT_SAFETY_REJECTED" },
  { ...base, result: "technical_error", error_code: "NORMAL_CHAT_TIMEOUT" },
] as const) assert.doesNotThrow(() => assertZeroEffectNonSuccess(validateNormalChatCandidateResponse(response)));

async function main(): Promise<void> {
  let constructions = 0;
  await assert.rejects(invokeChatProductPath({
    fixture_id: "chat-zh-hant-reflection-01",
    controls: {
      accepted_dice_evidence_sha256: null,
      accepted_deployment_receipt_sha256: null,
      accepted_traffic_receipt_sha256: null,
    },
    dice_evidence: null,
    dice_binding: {
      source_commit: null,
      source_tree: null,
      release_package_sha256: null,
      release_manifest_sha256: null,
      evidence_sha256: null,
    },
    create_transport: () => {
      constructions += 1;
      return { invoke: async () => ({}) };
    },
  }), /CHAT_PRODUCT_PATH_DISABLED/);
  assert.equal(constructions, 0);
  console.log("S2_T326_CHAT_PRODUCT_PATH_MOBILE_OK");
}

void main();
