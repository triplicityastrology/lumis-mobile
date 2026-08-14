// @ts-expect-error The fixture runs in Node; this repo does not pin @types/node.
import assert from "node:assert/strict";

import {
  ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256,
  FOUNDER_CHAT_FIXTURE_IDS,
  validateAcceptedTechnical80Evidence,
  validateFounderChatWindowAuthority,
} from "./founder-chat-window-v1";

const evidence = {
  schema: "s2_t345_technical_80_metadata_receipt_v1",
  scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  authorization_sha256: "3ab68e355262a1068282924071d3dfac0c3b3b6c5337e3c8a695becf2c199a28",
  run_id: "dice-tech80-981f8f6406cc3c86b2c939ce",
  microsoft_contract_commit: "c1ec632fdea1f2677621f8b1bd3a71e72d17f071",
  microsoft_contract_seal_sha256: "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c",
  integrated_contract_seal_sha256: "256cd3a0d35de069ea69c05834903d7f987183d72075cd534b074ed00e7d4ae5",
  source_provenance_manifest_sha256: "569fec6b7700d26735cb42595e102f6b216ca6c6fa37cffd02d8917803752852",
  prompt_version: "lumis_dice_v0_3_prompt_v2",
  result_schema: "lumis_dice_v0_3_result_v2",
  technical_cases: 80,
  language: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  attempts: 96,
  attempt_cap: 160,
  concurrency_cap: 2,
  eligible_retries: 1,
  shared_deadline_ms: 12000,
  input_token_cap: 800,
  output_token_cap: 300,
  tokenizer: "js-tiktoken@1.0.21/o200k_base",
  guardrail: "Microsoft.DefaultV2",
  cost_upper_bound_usd: 0.014991,
  cost_ceiling_usd: 0.128,
  evidence_sha256: "4633f4ebd5582ce1536335274d605eb977a3b8a5f5eb1f3f5d5ff07ea24819aa",
  finally_disable_executed: true,
  provider_disabled_verified: true,
  ambiguous_redispatches: 0,
  units_charged: 0,
  persistence_writes: 0,
  recorded_at: "2026-08-14T11:21:48.430Z",
};
validateAcceptedTechnical80Evidence(evidence, ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256);
assert.throws(() => validateAcceptedTechnical80Evidence({ ...evidence, founder_cases: 1 }, ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256), /EVIDENCE_INVALID/);
assert.throws(() => validateAcceptedTechnical80Evidence(evidence, "0".repeat(64)), /EVIDENCE_INVALID/);

const packageSha = "a".repeat(64);
const issued = "2026-08-14T12:00:00.000Z";
const authority = {
  schema: "lumis_founder_chat_synthetic_window_authorization_v1",
  decision: "AUTHORIZED",
  scope: "FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY",
  accepted_dice_evidence_sha256: ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256,
  review_package_sha256: packageSha,
  fixture_ids: FOUNDER_CHAT_FIXTURE_IDS,
  caps: { logical: 12, en: 6, zh_hant: 6, attempts: 24, concurrency: 1, deadline_ms: 12000, retries: 1, input_tokens: 1200, output_tokens: 300 },
  issued_at: issued,
  valid_until: "2026-08-14T12:15:00.000Z",
  normal_chat_integration_authorized: false,
  member_traffic_authorized: false,
  persistence_authorized: false,
  units_authorized: false,
};
validateFounderChatWindowAuthority(authority, Date.parse(issued), packageSha);
assert.throws(() => validateFounderChatWindowAuthority({ ...authority, fixture_ids: [...FOUNDER_CHAT_FIXTURE_IDS, "chat_en_waiting_v1"] }, Date.parse(issued), packageSha), /AUTHORITY_INVALID/);
assert.throws(() => validateFounderChatWindowAuthority({ ...authority, normal_chat_integration_authorized: true }, Date.parse(issued), packageSha), /AUTHORITY_INVALID/);
assert.throws(() => validateFounderChatWindowAuthority({ ...authority, valid_until: "2026-08-14T12:15:01.000Z" }, Date.parse(issued), packageSha), /AUTHORITY_INVALID/);
console.log("FOUNDER_CHAT_WINDOW_SERVER_OK");
