import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { createChatSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const NOW = Date.parse("2026-08-11T04:00:00.000Z");
const FOUNDER_PACKAGE_SHA = "f".repeat(64);

const founderDiceReceipt = {
  schema: "s2_t345_technical_80_metadata_receipt_v1", scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  authorization_sha256: "3ab68e355262a1068282924071d3dfac0c3b3b6c5337e3c8a695becf2c199a28",
  run_id: "dice-tech80-981f8f6406cc3c86b2c939ce", microsoft_contract_commit: "c1ec632fdea1f2677621f8b1bd3a71e72d17f071",
  microsoft_contract_seal_sha256: "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c",
  integrated_contract_seal_sha256: "256cd3a0d35de069ea69c05834903d7f987183d72075cd534b074ed00e7d4ae5",
  source_provenance_manifest_sha256: "569fec6b7700d26735cb42595e102f6b216ca6c6fa37cffd02d8917803752852",
  prompt_version: "lumis_dice_v0_3_prompt_v2", result_schema: "lumis_dice_v0_3_result_v2",
  technical_cases: 80, language: { en: 40, "zh-Hant": 40 }, founder_cases: 0, attempts: 96,
  attempt_cap: 160, concurrency_cap: 2, eligible_retries: 1, shared_deadline_ms: 12000,
  input_token_cap: 800, output_token_cap: 300, tokenizer: "js-tiktoken@1.0.21/o200k_base",
  guardrail: "Microsoft.DefaultV2", cost_upper_bound_usd: 0.014991, cost_ceiling_usd: 0.128,
  evidence_sha256: "4633f4ebd5582ce1536335274d605eb977a3b8a5f5eb1f3f5d5ff07ea24819aa",
  finally_disable_executed: true, provider_disabled_verified: true, ambiguous_redispatches: 0,
  units_charged: 0, persistence_writes: 0, recorded_at: "2026-08-14T11:21:48.430Z",
};

const founderWindowAuthority = {
  schema: "lumis_founder_chat_synthetic_window_authorization_v1", decision: "AUTHORIZED",
  scope: "FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY",
  accepted_dice_evidence_sha256: "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612",
  review_package_sha256: FOUNDER_PACKAGE_SHA,
  fixture_ids: [
    "chat_en_small_decision_v1", "chat_zh_hant_small_decision_v1",
    "chat_en_difficult_conversation_v1", "chat_zh_hant_difficult_conversation_v1",
    "chat_en_uncertain_change_v1", "chat_zh_hant_uncertain_change_v1",
    "chat_en_rest_without_guilt_v1", "chat_zh_hant_rest_without_guilt_v1",
    "chat_en_boundary_v1", "chat_zh_hant_boundary_v1",
    "chat_en_unsafe_medical_v1", "chat_zh_hant_unsafe_medical_v1",
  ],
  caps: { logical: 12, en: 6, zh_hant: 6, attempts: 24, concurrency: 1, deadline_ms: 12000, retries: 1, input_tokens: 1200, output_tokens: 300 },
  issued_at: "2026-08-11T03:55:00.000Z", valid_until: "2026-08-11T04:10:00.000Z",
  normal_chat_integration_authorized: false, member_traffic_authorized: false,
  persistence_authorized: false, units_authorized: false,
};

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    schema: "lumis_dice_technical_window_80_accepted_evidence_v4",
    review_decision: "accepted",
    deployment_receipt: {
      schema: "lumis_dice_default_off_function_deployment_receipt_v4",
      authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
      source_commit: "e".repeat(40), runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
      disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
      provider_calls: 0, model_invocations: 0, migration_applied: false, post_deploy_disabled: true,
    },
    technical_window: {
      schema: "lumis_dice_technical_window_80_evidence_v4", authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY", evidence_package_sha256: SHA_B,
      logical_total: 80, en: 40, zh_hant: 40, attempt_total: 96, max_attempts: 160,
      input_token_limit: 800, output_token_limit: 300, concurrency_limit: 2, shared_deadline_ms: 12000, cost_ceiling_usd: 0.128,
      provider_disabled_verified: true, finally_disabled: true, post_window_disabled_proof_sha256: SHA_A,
      founder_cases_run: 0, persistence_writes: 0, units_charged: 0,
    },
    accepted_at: "2026-08-11T03:00:00.000Z",
    ...overrides,
  };
}

function authority(overrides: Record<string, unknown> = {}) {
  return {
    schema: "s2_t260_chat_single_use_authority_v1",
    authority: "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED",
    scope: "closed_fixture_registry_60",
    gateway_interface: "chat_synthetic_gateway_port_v1",
    review_package_sha256: SHA_D,
    gateway_source_sha256: SHA_A,
    fixture_registry_sha256: SHA_B,
    canonical_t240_schema_sha256: "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07",
    dice_evidence_sha256: "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612",
    run_id: "chat-syn-0123456789ab",
    caps: { logical: 60, en: 30, zh_hant: 30, attempts: 120, input_tokens: 1200, output_tokens: 300, concurrency: 1, deadline_ms: 12000, retries: 1 },
    issued_at: "2026-08-11T03:00:00.000Z",
    valid_until: "2026-08-11T05:00:00.000Z",
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    fixture_id: "chat_en_small_decision_v1",
    idempotency_key: "edge-fixture-key-0001",
    run_id: "chat-syn-0123456789ab",
    ...overrides,
  };
}

const enabledEnvironment = {
  LUMIS_CHAT_AI_ENABLED: "true",
  LUMIS_CHAT_TRAFFIC_AUTHORIZED: "true",
  LUMIS_CHAT_AZURE_API_KEY: "fixture-only-key",
  LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256: "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612",
  LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256: SHA_A,
  LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_JSON: JSON.stringify(founderDiceReceipt),
  LUMIS_CHAT_ACCEPTED_AUTHORITY_JSON: JSON.stringify(authority()),
  LUMIS_CHAT_REVIEW_PACKAGE_SHA256: SHA_D,
  LUMIS_CHAT_GATEWAY_SOURCE_SHA256: SHA_A,
  LUMIS_CHAT_FIXTURE_REGISTRY_SHA256: SHA_B,
  LUMIS_CHAT_FOUNDER_WINDOW_AUTHORITY_JSON: JSON.stringify(founderWindowAuthority),
  LUMIS_CHAT_FOUNDER_WINDOW_PACKAGE_SHA256: FOUNDER_PACKAGE_SHA,
  SUPABASE_URL: "https://bmqhwofmdgebpcihjlnb.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
};

async function main() {
  let clientConstructions = 0;
  let providerCalls = 0;
  const disabled = createChatSyntheticEdgeHandler({
    environment: { ...enabledEnvironment, LUMIS_CHAT_AI_ENABLED: "false" },
    createAuthorityClient() { clientConstructions += 1; throw new Error("must not construct"); },
    async fetchImpl() { providerCalls += 1; throw new Error("must not fetch"); },
  });
  const disabledResponse = await disabled(new Request("http://local.invalid", { method: "POST", body: "not-json" }));
  assert.equal(disabledResponse.status, 503);
  assert.deepEqual(await disabledResponse.json(), { error: { code: "CHAT_AI_DISABLED" } });
  assert.equal(clientConstructions, 0);
  assert.equal(providerCalls, 0);

  const invalidFounderAuthority = createChatSyntheticEdgeHandler({
    environment: {
      ...enabledEnvironment,
      LUMIS_CHAT_FOUNDER_WINDOW_AUTHORITY_JSON: JSON.stringify({
        ...founderWindowAuthority,
        member_traffic_authorized: true,
      }),
    },
    nowMs: () => NOW,
    createAuthorityClient() { clientConstructions += 1; throw new Error("must not construct"); },
    async fetchImpl() { providerCalls += 1; throw new Error("must not fetch"); },
  });
  const invalidFounderResponse = await invalidFounderAuthority(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  }));
  assert.equal(invalidFounderResponse.status, 503);
  assert.deepEqual(await invalidFounderResponse.json(), { error: { code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" } });
  assert.equal(clientConstructions, 0);
  assert.equal(providerCalls, 0);

  const trafficDisabled = createChatSyntheticEdgeHandler({
    environment: { ...enabledEnvironment, LUMIS_CHAT_TRAFFIC_AUTHORIZED: "false" },
    createAuthorityClient() { clientConstructions += 1; throw new Error("must not construct"); },
    async fetchImpl() { providerCalls += 1; throw new Error("must not fetch"); },
  });
  const trafficDisabledResponse = await trafficDisabled(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  }));
  assert.equal(trafficDisabledResponse.status, 503);
  assert.deepEqual(await trafficDisabledResponse.json(), { error: { code: "CHAT_TRAFFIC_NOT_AUTHORIZED" } });
  assert.equal(clientConstructions, 0);
  assert.equal(providerCalls, 0);

  const rpcCalls: Array<{ name: string; parameters: Readonly<Record<string, unknown>> }> = [];
  const handler = createChatSyntheticEdgeHandler({
    environment: enabledEnvironment,
    nowMs: () => NOW,
    createAuthorityClient() {
      clientConstructions += 1;
      return {
        async rpc(name, parameters) {
          rpcCalls.push({ name, parameters });
          return { data: "consumed", error: null };
        },
      };
    },
    async fetchImpl(url, init) {
      providerCalls += 1;
      assert.equal(String(url), "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com/openai/v1/responses");
      const request = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(request).sort(), ["input", "max_output_tokens", "model", "store"]);
      assert.equal(request.model, "lumis-ai-chat-stg");
      assert.equal(request.store, false);
      return new Response(JSON.stringify({ output_text: "Take one small, grounded step." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const response = await handler(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  }));
  assert.equal(response.status, 200);
  const result = await response.json() as Record<string, unknown>;
  assert.equal(result.result, "completed");
  assert.equal(result.units_charged, 0);
  assert.equal(result.persistence, "not_committed");
  assert.equal(providerCalls, 1);

  const outsideFounderWindow = await handler(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body({ fixture_id: "chat_en_waiting_v1" })),
  }));
  assert.equal(outsideFounderWindow.status, 400);
  assert.deepEqual(await outsideFounderWindow.json(), { error: { code: "CHAT_SYNTHETIC_FIXTURE_NOT_ALLOWED" } });
  assert.equal(providerCalls, 1);
  assert.deepEqual(rpcCalls.map(({ name }) => name), ["consume_chat_synthetic_authority_v1", "consume_chat_synthetic_fixture_v1"]);
  assert.equal(JSON.stringify(rpcCalls).includes("edge-fixture-key-0001"), false);

  const wrongPackageHandler = createChatSyntheticEdgeHandler({
    environment: { ...enabledEnvironment, LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_JSON: JSON.stringify({ ...founderDiceReceipt, founder_cases: 1 }) },
    nowMs: () => NOW,
    createAuthorityClient() { return { async rpc() { return { data: "consumed", error: null }; } }; },
    async fetchImpl() { providerCalls += 1; throw new Error("must not fetch"); },
  });
  const wrongPackage = await wrongPackageHandler(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  }));
  assert.equal(wrongPackage.status, 503);
  assert.deepEqual(await wrongPackage.json(), { error: { code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" } });
  assert.equal(providerCalls, 1);

  const unknownField = await handler(new Request("http://local.invalid", {
    method: "POST",
    body: JSON.stringify({ ...body(), member_id: "forbidden" }),
  }));
  assert.equal(unknownField.status, 400);
  assert.equal(providerCalls, 1);

  const idempotencyDigest = String(rpcCalls.find(({ name }) => name === "consume_chat_synthetic_fixture_v1")?.parameters.p_idempotency_sha256);
  assert.equal(idempotencyDigest, createHash("sha256").update("edge-fixture-key-0001").digest("hex"));
  console.log("S2-T270 wrapper-to-port-to-ledger emulator passed; network=disabled; provider_calls=1 fixture-only");
}

main();
