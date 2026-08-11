import { strict as assert } from "node:assert";
import {
  CHAT_AZURE_APPROVED_HOSTNAME,
  CHAT_AZURE_API_VERSION,
  CHAT_AZURE_ROUTE_FAMILY,
  readChatAzureServerConfig
} from "./azure-chat-synthetic-adapter-v1.ts";
import {
  CHAT_CANONICAL_T240_SCHEMA_SHA256,
  ChatSyntheticGatewayPortV1,
  ChatSyntheticPortError,
  type ChatSyntheticAuthorityStore
} from "./chat-synthetic-gateway-port-v1.ts";
import { ChatSyntheticRun, type ProviderResult } from "./chat-synthetic-gateway-v1.ts";
import { chatServerTokenizer } from "./chat-tokenizer-v1.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const NOW = Date.parse("2026-08-09T12:00:00.000Z");
function evidence(overrides: Record<string, unknown> = {}) {
  return {
    schema: "s2_t284_dice_technical_evidence_acceptance_v1",
    review_decision: "accepted",
    deployment_receipt: {
      schema: "s2_t282_dice_default_off_deployment_receipt_v1",
      source_commit: "e".repeat(40),
      runtime_package_sha256: SHA_D,
      disabled_probes: ["DICE_AI_DISABLED", "DICE_AI_DISABLED", "DICE_AI_DISABLED", "DICE_AI_DISABLED"],
      provider_calls: 0,
      model_invocations: 0,
      migration_applied: false
    },
    technical_window: {
      authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
      evidence_package_sha256: SHA_C,
      logical_total: 80,
      en: 40,
      zh_hant: 40,
      attempt_total: 96,
      max_attempts: 160,
      provider_disabled_verified: true,
      founder_cases_run: 0,
      persistence_writes: 0,
      units_charged: 0
    },
    accepted_at: "2026-08-09T11:00:00.000Z",
    ...overrides
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
    canonical_t240_schema_sha256: CHAT_CANONICAL_T240_SCHEMA_SHA256,
    dice_evidence_sha256: SHA_C,
    run_id: "chat-syn-0123456789ab",
    caps: { logical: 60, en: 30, zh_hant: 30, attempts: 120, input_tokens: 1200, output_tokens: 300, concurrency: 1, deadline_ms: 12000, retries: 1 },
    issued_at: "2026-08-09T11:00:00.000Z",
    valid_until: "2026-08-09T13:00:00.000Z",
    ...overrides
  };
}

function atomicStore(): ChatSyntheticAuthorityStore {
  const authorities = new Map<string, { packageSha: string; runId: string; closed: boolean }>();
  const fixtures = new Map<string, string>();
  return {
    async consumeAuthority(input) {
      const runKey = `${input.reviewPackageSha256}:${input.runId}`;
      if (authorities.has(input.authoritySha256) || [...authorities.values()].some((item) => `${item.packageSha}:${item.runId}` === runKey)) return "replayed";
      authorities.set(input.authoritySha256, { packageSha: input.reviewPackageSha256, runId: input.runId, closed: false });
      return "consumed";
    },
    async consumeFixture(input) {
      const authorityRow = authorities.get(input.authoritySha256);
      if (!authorityRow) return "authority_missing";
      if (authorityRow.closed || authorityRow.packageSha !== input.reviewPackageSha256 || authorityRow.runId !== input.runId) return "conflict";
      const key = `${input.authoritySha256}:${input.fixtureId}`;
      const prior = fixtures.get(key);
      if (prior) return prior === input.idempotencyKey ? "replayed" : "conflict";
      fixtures.set(key, input.idempotencyKey);
      return "consumed";
    },
    async closeAuthority(input) {
      const row = authorities.get(input.authoritySha256);
      if (!row) return "authority_missing";
      if (row.packageSha !== input.reviewPackageSha256 || row.runId !== input.runId) return "conflict";
      if (row.closed) return "already_closed";
      row.closed = true;
      return "closed";
    }
  };
}

function unavailableStore(): ChatSyntheticAuthorityStore {
  const unavailable = async (): Promise<never> => { throw new Error("database unavailable"); };
  return { consumeAuthority: unavailable, consumeFixture: unavailable, closeAuthority: unavailable };
}

function makePort(
  store: ChatSyntheticAuthorityStore,
  results: ProviderResult[] = [{ kind: "completed", assistantMessage: "A bounded reflection." }]
) {
  let calls = 0;
  const gateway = new ChatSyntheticRun({
    aiEnabled: true,
    nowMs: () => NOW,
    recordMetadata() {},
    adapter: { async complete() { return results[Math.min(calls++, results.length - 1)]; } }
  });
  const port = new ChatSyntheticGatewayPortV1({
    gateway,
    authorityStore: store,
    nowMs: () => NOW,
    control: {
      executionAuthority: true,
      acceptedDiceEvidenceSha256: SHA_C,
      acceptedAuthoritySha256: SHA_A,
      reviewPackageSha256: SHA_D,
      gatewaySourceSha256: SHA_A,
      fixtureRegistrySha256: SHA_B
    }
  });
  return { port, calls: () => calls };
}

function authorize(port: ChatSyntheticGatewayPortV1) {
  return port.authorize({ diceEvidence: evidence(), diceEvidenceSha256: SHA_C, authority: authority(), authoritySha256: SHA_A });
}

function expectCode(action: () => unknown | Promise<unknown>, code: string) {
  return assert.rejects(async () => action(), (error: unknown) => error instanceof ChatSyntheticPortError && error.code === code);
}

async function main() {
  assert.equal(chatServerTokenizer.version, "o200k_base");
  assert.equal(chatServerTokenizer.count("hello"), 1);
  assert.notEqual(chatServerTokenizer.count("你好🙂"), Array.from("你好🙂").length / 3);
  const oversizedOutput = Array.from({ length: 301 }, () => "測").join(" ");
  assert.ok(chatServerTokenizer.count(oversizedOutput) > 300);
  assert.ok(oversizedOutput.length < 1800);

  const tokenPort = makePort(atomicStore(), [{ kind: "completed", assistantMessage: oversizedOutput }]);
  await authorize(tokenPort.port);
  const tokenRequest = { fixture_id: "chat_en_small_decision_v1", idempotency_key: "token-limit-key-001", run_id: "chat-syn-0123456789ab" };
  const tokenResult = await tokenPort.port.invokeFixture(tokenRequest);
  assert.equal(tokenResult.result, "fixed_fallback");
  assert.equal(tokenResult.error_code, "CHAT_SYNTHETIC_OUTPUT_INVALID");
  await expectCode(() => tokenPort.port.invokeFixture(tokenRequest), "CHAT_SYNTHETIC_FIXTURE_REPLAYED");
  assert.equal(tokenPort.calls(), 1);

  let inputLimitCalls = 0;
  const inputLimit = new ChatSyntheticRun({
    aiEnabled: true,
    nowMs: () => NOW,
    recordMetadata() {},
    tokenizer: { version: "o200k_base", count: () => 1201 },
    adapter: { async complete() { inputLimitCalls += 1; return { kind: "completed", assistantMessage: "must not run" }; } }
  });
  const inputLimitResult = await inputLimit.handle({ fixture_id: "chat_en_small_decision_v1", idempotency_key: "input-limit-key-001", run_id: "chat-syn-0123456789ab" });
  assert.equal(inputLimitResult.error_code, "CHAT_SYNTHETIC_INPUT_LIMIT");
  assert.equal(inputLimitCalls, 0);

  const gated = makePort(atomicStore());
  await expectCode(() => gated.port.invokeFixture({ fixture_id: "chat_en_small_decision_v1", idempotency_key: "authority-key-0001", run_id: "chat-syn-0123456789ab" }), "CHAT_SYNTHETIC_AUTHORITY_REQUIRED");
  await expectCode(
    () => gated.port.authorize({ diceEvidence: evidence({ review_decision: "pending" }), diceEvidenceSha256: SHA_C, authority: authority(), authoritySha256: SHA_A }),
    "CHAT_SYNTHETIC_DICE_EVIDENCE_INVALID"
  );
  await authorize(gated.port);
  const request = { fixture_id: "chat_en_small_decision_v1", idempotency_key: "authority-key-0001", run_id: "chat-syn-0123456789ab" };
  assert.equal((await gated.port.invokeFixture(request)).result, "completed");
  await expectCode(() => gated.port.invokeFixture(request), "CHAT_SYNTHETIC_FIXTURE_REPLAYED");
  await expectCode(() => gated.port.invokeFixture({ ...request, idempotency_key: "authority-key-0002" }), "CHAT_SYNTHETIC_FIXTURE_ALREADY_USED");
  await expectCode(() => gated.port.invokeFixture({ ...request, member_id: "forbidden" }), "CHAT_SYNTHETIC_INVALID_REQUEST");
  assert.equal(gated.calls(), 1);
  await gated.port.disable(request.run_id);

  const shared = atomicStore();
  const instanceA = makePort(shared);
  const instanceB = makePort(shared);
  const raced = await Promise.allSettled([authorize(instanceA.port), authorize(instanceB.port)]);
  assert.equal(raced.filter(({ status }) => status === "fulfilled").length, 2);

  const fixtureRaceStore = atomicStore();
  const storeAuthority = {
    authoritySha256: SHA_A, reviewPackageSha256: SHA_D, runId: "chat-syn-0123456789ab",
    diceEvidenceSha256: SHA_C, gatewaySourceSha256: SHA_A, fixtureRegistrySha256: SHA_B,
    validUntil: "2026-08-09T13:00:00.000Z"
  };
  assert.equal(await fixtureRaceStore.consumeAuthority(storeAuthority), "consumed");
  const fixtureBinding = {
    authoritySha256: SHA_A, reviewPackageSha256: SHA_D, runId: "chat-syn-0123456789ab",
    fixtureId: "chat_en_small_decision_v1"
  };
  const conflictingClaims = await Promise.all([
    fixtureRaceStore.consumeFixture({ ...fixtureBinding, idempotencyKey: "cross-instance-key-a" }),
    fixtureRaceStore.consumeFixture({ ...fixtureBinding, idempotencyKey: "cross-instance-key-b" })
  ]);
  assert.deepEqual([...conflictingClaims].sort(), ["conflict", "consumed"]);
  const replayBinding = { ...fixtureBinding, fixtureId: "chat_en_difficult_conversation_v1", idempotencyKey: "cross-instance-same-key" };
  const replayClaims = await Promise.all([
    fixtureRaceStore.consumeFixture(replayBinding),
    fixtureRaceStore.consumeFixture(replayBinding)
  ]);
  assert.deepEqual([...replayClaims].sort(), ["consumed", "replayed"]);

  const unavailable = makePort(unavailableStore());
  await expectCode(() => authorize(unavailable.port), "CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE");
  assert.equal(unavailable.calls(), 0);

  const validConfig = readChatAzureServerConfig({
    LUMIS_CHAT_AI_ENABLED: "true",
    LUMIS_CHAT_AZURE_API_KEY: "fixture-only-secret"
  });
  assert.equal(validConfig.ok, true);
  if (!validConfig.ok) throw new Error("fixture config unavailable");
  assert.equal(validConfig.config.origin, `https://${CHAT_AZURE_APPROVED_HOSTNAME}`);
  assert.equal(validConfig.config.routeFamily, CHAT_AZURE_ROUTE_FAMILY);
  assert.equal(CHAT_AZURE_API_VERSION, null);
  assert.equal(readChatAzureServerConfig({ LUMIS_CHAT_AI_ENABLED: "false", LUMIS_CHAT_AZURE_API_KEY: "fixture" }).ok, false);
  assert.equal(readChatAzureServerConfig({ LUMIS_CHAT_AI_ENABLED: "true" }).ok, false);

  console.log("S2-T260 cross-instance authority, hostile token, replay, and evidence fixtures passed");
}

main();
