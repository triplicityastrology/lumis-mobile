import assert from "node:assert/strict";
import { DICE_INTERPRETATION_REQUEST_VERSION } from "./dice-interpretation-v1";
import { OfflineDiceInterpretationHarness } from "./dice-interpretation-offline-engine";

const id = "1d268c24-75d0-4d4d-9ff2-bebb0c50fbd1";
const input = (question = "Should I take the next step?", idempotencyKey = id) => ({
  idempotencyKey,
  request: { schemaVersion: DICE_INTERPRETATION_REQUEST_VERSION, question, outcome: { planet: "venus", sign: "sagittarius", house: "house_10" } },
  trusted: { questionShape: "judgment", safetyDisposition: "ordinary", appLanguage: "en" }
});
async function runFixtures() {
const successHarness = new OfflineDiceInterpretationHarness();
const success = await successHarness.run(input(), "success");
assert.equal(success.status, "completed");
assert.deepEqual(success.evidence, { provider_calls: 1, persistence_writes: 0, units_consumed: 0, idempotency: "new" });
assert.equal(successHarness.getProviderCallCount(), 1);
const replay = await successHarness.run(input(), "success");
assert.equal(replay.evidence.idempotency, "replay");
assert.equal(replay.evidence.provider_calls, 0);
assert.equal(successHarness.getProviderCallCount(), 1);

const concurrentHarness = new OfflineDiceInterpretationHarness();
const concurrent = await Promise.all([concurrentHarness.run(input(), "success"), concurrentHarness.run(input(), "success")]);
assert.equal(concurrentHarness.getProviderCallCount(), 1);
assert.deepEqual(concurrent.map((item) => item.status), ["completed", "completed"]);

for (const [mode, status, calls] of [["timeout", "fallback", 2], ["unavailable", "fallback", 2], ["malformed", "fallback", 1], ["content_filter", "safety_redirect", 1]] as const) {
  const harness = new OfflineDiceInterpretationHarness();
  const result = await harness.run(input(undefined, crypto.randomUUID()), mode);
  assert.equal(result.status, status);
  assert.equal(result.evidence.provider_calls, calls);
  assert.equal(result.evidence.persistence_writes, 0);
  assert.equal(result.evidence.units_consumed, 0);
  assert.equal("prompt" in result || "raw" in result || "provider" in result, false);
}

const zhHarness = new OfflineDiceInterpretationHarness();
const zh = await zhHarness.run({ ...input("我應該接受這個機會嗎？", crypto.randomUUID()), trusted: { questionShape: "judgment", safetyDisposition: "ordinary", appLanguage: "zh-Hant" } }, "success");
assert.equal(zh.status, "completed");
assert.equal(zh.response?.language, "zh-Hant");

const safetyHarness = new OfflineDiceInterpretationHarness();
const safety = await safetyHarness.run({ ...input(undefined, crypto.randomUUID()), trusted: { questionShape: "open_reflection", safetyDisposition: "crisis_imminent", appLanguage: "en" } }, "success");
assert.equal(safety.status, "safety_redirect");
assert.equal(safety.evidence.provider_calls, 0);

const invalidHarness = new OfflineDiceInterpretationHarness();
const invalid = await invalidHarness.run({ ...input(undefined, crypto.randomUUID()), chart_context: {} }, "success");
assert.equal(invalid.status, "rejected");
assert.deepEqual(invalid.evidence, { provider_calls: 0, persistence_writes: 0, units_consumed: 0, idempotency: "new" });
console.log("S2-T218 offline Dice interpretation engine fixtures passed");
}

void runFixtures().catch((error) => {
  process.stderr.write("S2_T218_FIXTURE_FAILED\n");
  throw error;
});
