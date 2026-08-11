import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { createChatSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const DICE_RUNTIME_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96";
const NOW = Date.parse("2026-08-11T04:00:00.000Z");

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    schema: "lumis_dice_technical_window_acceptance_v2",
    review_decision: "accepted",
    runtime_source_commit: DICE_RUNTIME_COMMIT,
    runtime_control_sha256: "b8d22c7c4677e654a83764f5499ddecb9bc97f327e115205ffd13848b5537be1",
    runtime_proof_sha256: "3f44ef8c674ae70037f1e34ffde9f0efb70862ee1bc4b158cadbeae50efe1256",
    technical_window_authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
    technical_evidence_package_sha256: SHA_B,
    logical_total: 80,
    en: 40,
    zh_hant: 40,
    provider_disabled_verified: true,
    founder_cases_run: 0,
    persistence_writes: 0,
    units_charged: 0,
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
    dice_evidence_sha256: SHA_C,
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
  LUMIS_CHAT_AZURE_API_KEY: "fixture-only-key",
  LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256: SHA_C,
  LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256: SHA_A,
  LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_JSON: JSON.stringify(evidence()),
  LUMIS_CHAT_ACCEPTED_AUTHORITY_JSON: JSON.stringify(authority()),
  LUMIS_CHAT_REVIEW_PACKAGE_SHA256: SHA_D,
  LUMIS_CHAT_GATEWAY_SOURCE_SHA256: SHA_A,
  LUMIS_CHAT_FIXTURE_REGISTRY_SHA256: SHA_B,
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
  assert.deepEqual(rpcCalls.map(({ name }) => name), ["consume_chat_synthetic_authority_v1", "consume_chat_synthetic_fixture_v1"]);
  assert.equal(JSON.stringify(rpcCalls).includes("edge-fixture-key-0001"), false);

  const wrongPackageHandler = createChatSyntheticEdgeHandler({
    environment: { ...enabledEnvironment, LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_JSON: JSON.stringify(evidence({ runtime_source_commit: "0".repeat(40) })) },
    nowMs: () => NOW,
    createAuthorityClient() { return { async rpc() { return { data: "consumed", error: null }; } }; },
    async fetchImpl() { providerCalls += 1; throw new Error("must not fetch"); },
  });
  const wrongPackage = await wrongPackageHandler(new Request("http://local.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  }));
  assert.equal(wrongPackage.status, 403);
  assert.deepEqual(await wrongPackage.json(), { error: { code: "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID" } });
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
