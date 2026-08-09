import { strict as assert } from "node:assert";
import {
  CHAT_SYNTHETIC_CAPS,
  CHAT_SYNTHETIC_FALLBACK,
  CHAT_SYNTHETIC_SAFETY_REDIRECT,
  ChatSyntheticRun,
  type ProviderResult
} from "./chat-synthetic-gateway-v1.ts";
import { assembleCompanionSyntheticPrompt, serializeCompanionSyntheticPrompt } from "./companion-synthetic-prompt-v1.ts";
import { chatServerTokenizer } from "./chat-tokenizer-v1.ts";
import { listChatSyntheticFixtures } from "./chat-synthetic-registry-v1.ts";

const request = (fixture_id = "chat_en_small_decision_v1", idempotency_key = "synthetic-key-0001") => ({
  fixture_id,
  idempotency_key,
  run_id: "chat-syn-00000001"
});

function harness(results: ProviderResult[], enabled = true) {
  let calls = 0;
  let now = 1_000;
  const telemetry: unknown[] = [];
  const run = new ChatSyntheticRun({
    aiEnabled: enabled,
    nowMs: () => now,
    recordMetadata: (event) => {
      telemetry.push(event);
    },
    adapter: {
      async complete() {
        const value = results[Math.min(calls, results.length - 1)];
        calls += 1;
        return value;
      }
    }
  });
  return { run, telemetry, calls: () => calls, advance: (ms: number) => { now += ms; } };
}

async function main() {
  const registry = listChatSyntheticFixtures();
  assert.equal(registry.length, 60);
  assert.equal(new Set(registry.map(({ id }) => id)).size, 60);
  assert.equal(registry.filter(({ language }) => language === "en").length, 30);
  assert.equal(registry.filter(({ language }) => language === "zh-Hant").length, 30);
  assert.equal(registry.filter(({ expectedClass }) => expectedClass === "safety").length, 12);
  for (const fixture of registry) {
    assert.match(fixture.id, /^chat_(?:en|zh_hant)_[a-z0-9_]+_v1$/);
    assert.doesNotMatch(JSON.stringify(fixture), /account_id|device_id|thread_id|birth|chart|persona|provenance|bearer|api[_ -]?key/iu);
    if (fixture.expectedClass === "reflection") {
      const serialized = serializeCompanionSyntheticPrompt(assembleCompanionSyntheticPrompt(fixture));
      assert.ok(chatServerTokenizer.count(serialized) <= CHAT_SYNTHETIC_CAPS.inputTokens);
      assert.doesNotMatch(serialized, /persona|provenance|member|account|birth/iu);
    }
  }
  const prompt = assembleCompanionSyntheticPrompt(registry[0]);
  assert.equal(prompt.version, "companion_synthetic_prompt_v1");
  assert.equal(prompt.language, "en");
  assert.doesNotMatch(JSON.stringify(prompt), /account_id|device_id|thread_id|birth_data|chart_context|persona|provenance/iu);
  assert.throws(
    () => assembleCompanionSyntheticPrompt(registry.find(({ expectedClass }) => expectedClass === "safety")!),
    /CHAT_SYNTHETIC_SAFETY_BEFORE_PROMPT/
  );

  const success = harness([{ kind: "completed", assistantMessage: "A synthetic reflection." }]);
  const completed = await success.run.handle(request());
  assert.equal(completed.result, "completed");
  assert.equal(completed.persistence, "not_committed");
  assert.equal(completed.units_charged, 0);
  assert.equal(success.calls(), 1);
  assert.deepEqual(Object.keys(completed).sort(), ["assistant_message", "fixture_id", "idempotency_outcome", "language", "persistence", "provider_attempts", "result", "schema_version", "units_charged"].sort());

  const replay = await success.run.handle(request());
  assert.equal(replay.result, "duplicate");
  assert.equal(replay.idempotency_outcome, "replayed");
  assert.equal(success.calls(), 1);

  const disabled = harness([{ kind: "completed", assistantMessage: "must not run" }], false);
  assert.equal((await disabled.run.handle(request())).error_code, "CHAT_SYNTHETIC_PROVIDER_DISABLED");
  assert.equal(disabled.calls(), 0);

  for (const hostile of [
    { ...request(), message: "free form forbidden" },
    { ...request(), account_id: "forbidden" },
    { ...request(), fixture_id: "unknown" },
    { fixture_id: "chat_en_small_decision_v1" }
  ]) {
    const result = await success.run.handle(hostile);
    assert.equal(result.result, "technical_error");
    assert.equal(result.units_charged, 0);
    assert.equal(result.persistence, "not_committed");
    assert.equal(result.assistant_message, undefined);
  }

  const safety = harness([{ kind: "completed", assistantMessage: "must not run" }]);
  const safetyResult = await safety.run.handle(request("chat_en_unsafe_harm_v1", "synthetic-key-safe"));
  assert.equal(safetyResult.result, "safety_rejected");
  assert.equal(safetyResult.assistant_message, CHAT_SYNTHETIC_SAFETY_REDIRECT);
  assert.equal(safety.calls(), 0);

  for (const filter of ["content_filter_block", "content_filter_partial"] as const) {
    const filtered = harness([{ kind: filter }]);
    const result = await filtered.run.handle(request("chat_en_small_decision_v1", `synthetic-${filter}`));
    assert.equal(result.result, "safety_rejected");
    assert.equal(result.provider_attempts, 1);
  }

  const postSafety = harness([{ kind: "completed", assistantMessage: "[[unsafe]]" }]);
  const postSafetyResult = await postSafety.run.handle(request("chat_en_small_decision_v1", "synthetic-post-safe"));
  assert.equal(postSafetyResult.result, "safety_rejected");
  assert.equal(postSafetyResult.assistant_message, CHAT_SYNTHETIC_SAFETY_REDIRECT);

  const retry = harness([
    { kind: "timeout" },
    { kind: "completed", assistantMessage: "Recovered once." }
  ]);
  const retryResult = await retry.run.handle(request("chat_en_small_decision_v1", "synthetic-retry-01"));
  assert.equal(retryResult.result, "completed");
  assert.equal(retryResult.provider_attempts, 2);
  assert.equal(retry.calls(), 2);

  for (const noRetry of ["unauthorized", "forbidden", "malformed"] as const) {
    const probe = harness([{ kind: noRetry }]);
    const result = await probe.run.handle(request("chat_en_small_decision_v1", `synthetic-no-retry-${noRetry}`));
    assert.equal(result.result, "technical_error");
    assert.equal(result.assistant_message, undefined);
    assert.equal(probe.calls(), 1);
  }

  const fallback = harness([{ kind: "network" }, { kind: "server_error" }]);
  const fallbackResult = await fallback.run.handle(request("chat_en_small_decision_v1", "synthetic-fallback"));
  assert.equal(fallbackResult.result, "fixed_fallback");
  assert.equal(fallbackResult.assistant_message, CHAT_SYNTHETIC_FALLBACK);
  assert.equal(fallbackResult.provider_attempts, 2);

  let release!: (value: ProviderResult) => void;
  let concurrentCalls = 0;
  const concurrent = new ChatSyntheticRun({
    aiEnabled: true,
    nowMs: () => 1_000,
    recordMetadata() {},
    adapter: { complete: () => { concurrentCalls += 1; return new Promise((resolve) => { release = resolve; }); } }
  });
  const first = concurrent.handle(request("chat_en_small_decision_v1", "synthetic-concurrent"));
  const duplicate = concurrent.handle(request("chat_en_small_decision_v1", "synthetic-concurrent"));
  await Promise.resolve();
  release({ kind: "completed", assistantMessage: "One call." });
  assert.equal((await first).result, "completed");
  assert.equal((await duplicate).result, "duplicate");
  assert.equal(concurrentCalls, 1);

  let releaseDistinct!: (value: ProviderResult) => void;
  const concurrencyCap = new ChatSyntheticRun({
    aiEnabled: true,
    nowMs: () => 1_000,
    recordMetadata() {},
    adapter: { complete: () => new Promise((resolve) => { releaseDistinct = resolve; }) }
  });
  const active = concurrencyCap.handle(request("chat_en_small_decision_v1", "synthetic-active-one"));
  await Promise.resolve();
  const capped = await concurrencyCap.handle(request("chat_en_small_decision_v1", "synthetic-active-two"));
  assert.equal(capped.error_code, "CHAT_SYNTHETIC_CONCURRENCY_CAP");
  releaseDistinct({ kind: "completed", assistantMessage: "Finished." });
  assert.equal((await active).result, "completed");

  const languageCap = harness([{ kind: "completed", assistantMessage: "Bounded." }]);
  for (let index = 0; index < 30; index += 1) {
    const result = await languageCap.run.handle(request("chat_en_small_decision_v1", `synthetic-en-cap-${String(index).padStart(3, "0")}`));
    assert.equal(result.result, "completed");
  }
  const overLanguageCap = await languageCap.run.handle(request("chat_en_small_decision_v1", "synthetic-en-cap-999"));
  assert.equal(overLanguageCap.error_code, "CHAT_SYNTHETIC_LOGICAL_CAP");
  assert.equal(languageCap.calls(), 30);

  assert.deepEqual(CHAT_SYNTHETIC_CAPS, {
    logicalRequests: 60, enRequests: 30, zhHantRequests: 30, providerAttempts: 120,
    inputTokens: 1200, outputTokens: 300, concurrency: 1, deadlineMs: 12000,
    retries: 1, telemetryRetentionDays: 30
  });
  assert.equal(JSON.stringify(success.telemetry).includes("A synthetic reflection"), false);
  console.log("S2-T250 chat synthetic gateway offline fixtures passed");
}

main();
