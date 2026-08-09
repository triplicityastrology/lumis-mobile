import { createAzureDiceAdapter, readDiceAzureServerConfig } from "./azure-dice-adapter-v0-3.ts";
import {
  DICE_AZURE_SERVER_ALIAS,
  DICE_INTERPRETATION_RESPONSE_VERSION,
  DICE_PROVIDER_DEADLINE_MS,
  DICE_SYNTHETIC_CAPS,
  DiceSyntheticGateway,
  DiceSyntheticRunBudget,
  type DiceAzureAdapter,
  type DiceProviderResult
} from "./dice-synthetic-gateway-v0-3.ts";
import { builtInDiceSyntheticRegistry, DICE_SYNTHETIC_REGISTRY_VERSION, type DiceSyntheticRegistry } from "./dice-synthetic-registry-v0-3.ts";
import { reviewedDiceSyntheticRegistry } from "./dice-synthetic-registry-adapter-v0-3.ts";

const completedOutput = {
  reading: "The landed symbols suggest a measured opening for dialogue.",
  watch_out: "Avoid treating the symbols as certainty.",
  practical_direction: "Choose one reversible next step."
};

runFixtures()
  .then(() => console.log("S2-T247 Dice synthetic Azure gateway fixtures passed"))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "S2-T247 fixture failure");
    throw error;
  });

async function runFixtures(): Promise<void> {
  const reviewedAdapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
  const reviewed = await new DiceSyntheticGateway(reviewedDiceSyntheticRegistry, reviewedAdapter, new DiceSyntheticRunBudget()).run({ fixture_id: "DICE-TECH-EN-JUDGMENT-01" });
  equal(reviewed.response.result, "completed", "reviewed uppercase fixture ID reaches the gateway");
  equal(reviewedAdapter.calls.length, 1, "reviewed fixture makes one stubbed provider attempt");
  const reserved = await new DiceSyntheticGateway(reviewedDiceSyntheticRegistry, reviewedAdapter, new DiceSyntheticRunBudget()).run({ fixture_id: "DICE-FOUNDER-EN-01" });
  equal(reserved.response.code, "DICE_SYNTHETIC_FIXTURE_NOT_ALLOWED", "unfrozen Founder slot stays unavailable");

  const successAdapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
  const success = await gateway(successAdapter).run({ fixture_id: "tech-en-judgment-001" });
  equal(success.response.result, "completed", "valid allow-listed fixture completes");
  equal(success.response.version, DICE_INTERPRETATION_RESPONSE_VERSION, "response version closed");
  equal(success.evidence.attempt_count, 1, "one provider attempt");
  zeroEffects(success.response.effects, "completed synthetic result");
  equal(successAdapter.calls.length, 1, "provider called once");
  equal(successAdapter.calls[0]?.providerAlias, DICE_AZURE_SERVER_ALIAS, "server alias only");
  equal(successAdapter.calls[0]?.maxOutputTokens, 300, "output cap passed to adapter");

  for (const hostile of [
    {},
    { fixture_id: "tech-en-judgment-001", question: "member text" },
    { fixture_id: "not-allow-listed" },
    { fixture_id: 123 },
    { question: "Is this allowed?" },
    { fixture_id: "../private" }
  ]) {
    const adapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
    const result = await gateway(adapter).run(hostile);
    equal(result.response.result, "rejected", "hostile request rejected");
    equal(adapter.calls.length, 0, "hostile request stops before adapter");
    zeroEffects(result.response.effects, "hostile request");
  }

  const safetyAdapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
  const safety = await gateway(safetyAdapter).run({ fixture_id: "tech-en-safety-001" });
  equal(safety.response.result, "safety_redirect", "deterministic safety before adapter");
  equal(safetyAdapter.calls.length, 0, "safety makes no provider call");

  const excludedAdapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
  const excluded = await gateway(excludedAdapter).run({ fixture_id: "tech-en-excluded-001" });
  equal(excluded.response.result, "rejected", "v0.3 excluded context rejected");
  equal(excludedAdapter.calls.length, 0, "excluded context makes no provider call");

  const driftedRegistry: DiceSyntheticRegistry = {
    version: DICE_SYNTHETIC_REGISTRY_VERSION,
    getFixture: () => ({
      fixtureId: "tech-en-drift-001",
      language: "en",
      question: "Is this supportive?",
      outcome: { planet: "venus", sign: "libra", house: "house_3" },
      expectedClassification: "descriptive",
      expectedSafety: "ordinary"
    })
  };
  const driftAdapter = sequenceAdapter([{ kind: "success", output: completedOutput }]);
  const drift = await new DiceSyntheticGateway(driftedRegistry, driftAdapter, new DiceSyntheticRunBudget()).run({ fixture_id: "tech-en-drift-001" });
  equal(drift.response.code, "DICE_FIXTURE_AUTHORITY_MISMATCH", "classification drift fails closed");
  equal(driftAdapter.calls.length, 0, "authority drift stops before adapter");

  for (const filteredKind of ["content_filter_block", "content_filter_partial"] as const) {
    const adapter = sequenceAdapter([{ kind: filteredKind }]);
    const filtered = await gateway(adapter).run({ fixture_id: "tech-en-judgment-001" });
    equal(filtered.response.result, "safety_redirect", `${filteredKind} maps to safe result`);
    equal(filtered.evidence.attempt_count, 1, `${filteredKind} is not retried`);
    zeroEffects(filtered.response.effects, filteredKind);
  }

  const retryAdapter = sequenceAdapter([{ kind: "network" }, { kind: "success", output: completedOutput }]);
  const retried = await gateway(retryAdapter).run({ fixture_id: "tech-en-judgment-001" });
  equal(retried.response.result, "completed", "eligible transient retries once");
  equal(retried.evidence.attempt_count, 2, "one bounded retry");
  equal(retryAdapter.calls.length, 2, "two attempts maximum");

  for (const noRetry of ["authentication", "permission", "invalid_output"] as const) {
    const adapter = sequenceAdapter([{ kind: noRetry }, { kind: "success", output: completedOutput }]);
    const result = await gateway(adapter).run({ fixture_id: "tech-en-judgment-001" });
    equal(result.response.result, "fixed_fallback", `${noRetry} safely falls back`);
    equal(adapter.calls.length, 1, `${noRetry} not retried`);
  }

  const malformed = await gateway(sequenceAdapter([{ kind: "success", output: { reading: "raw provider body" } }])).run({ fixture_id: "tech-en-judgment-001" });
  equal(malformed.response.result, "fixed_fallback", "malformed output rejected");
  equal(Object.hasOwn(malformed.response, "provider"), false, "provider diagnostics absent");

  const longOutput = "x".repeat(DICE_SYNTHETIC_CAPS.maxOutputTokens + 1);
  const oversized = await gateway(sequenceAdapter([{ kind: "success", output: { ...completedOutput, reading: longOutput } }])).run({ fixture_id: "tech-en-judgment-001" });
  equal(oversized.response.code, "DICE_PROVIDER_OUTPUT_INVALID", "output token cap enforced");

  let now = 0;
  const deadlineAdapter: DiceAzureAdapter = {
    async invoke() {
      now = DICE_PROVIDER_DEADLINE_MS;
      return { kind: "network" };
    }
  };
  const deadline = await new DiceSyntheticGateway(builtInDiceSyntheticRegistry, deadlineAdapter, new DiceSyntheticRunBudget(), { now: () => now }).run({ fixture_id: "tech-en-judgment-001" });
  equal(deadline.response.code, "DICE_PROVIDER_DEADLINE", "shared 12-second deadline blocks retry");
  equal(deadline.evidence.attempt_count, 1, "deadline did not create second attempt");

  const held: Array<() => void> = [];
  const concurrentAdapter: DiceAzureAdapter = {
    invoke: async () => new Promise<DiceProviderResult>((resolve) => held.push(() => resolve({ kind: "success", output: completedOutput })))
  };
  const concurrentGateway = gateway(concurrentAdapter);
  const first = concurrentGateway.run({ fixture_id: "tech-en-judgment-001" });
  const second = concurrentGateway.run({ fixture_id: "tech-zh-descriptive-001" });
  await Promise.resolve();
  const third = await concurrentGateway.run({ fixture_id: "tech-en-judgment-001" });
  equal(third.response.code, "DICE_CAP_CONCURRENCY_EXHAUSTED", "concurrency cap is two");
  held.splice(0).forEach((release) => release());
  await Promise.all([first, second]);

  const languageBudget = new DiceSyntheticRunBudget();
  for (let index = 0; index < 60; index += 1) {
    equal(languageBudget.beginLogical("en"), null, `EN logical cap accepts ${index + 1}`);
    languageBudget.finishLogical();
  }
  equal(languageBudget.beginLogical("en"), "DICE_CAP_LANGUAGE_EXHAUSTED", "61st EN fixture rejected");
  equal(languageBudget.snapshot().logical, 60, "rejected cap does not increment logical count");

  const disabled = readDiceAzureServerConfig({ LUMIS_AI_ENABLED: "false" });
  equal(disabled.ok, false, "default-off config fails before adapter construction");
  if (!disabled.ok) equal(disabled.code, "DICE_AI_DISABLED", "stable disabled code");
  const absent = readDiceAzureServerConfig({});
  equal(absent.ok, false, "absent enable flag fails closed");

  let fetchCalls = 0;
  const configured = readDiceAzureServerConfig({
    LUMIS_AI_ENABLED: "true",
    LUMIS_AI_PROVIDER_ALIAS: "lumis-ai-chat-stg",
    LUMIS_AI_DEPLOYMENT_FAMILY: "gpt-5-mini",
    AZURE_OPENAI_ENDPOINT: "https://synthetic.invalid",
    AZURE_OPENAI_API_KEY: "fixture-key-not-a-secret",
    AZURE_OPENAI_API_VERSION: "fixture-version"
  });
  truthy(configured.ok, "complete server config accepted in test only");
  if (configured.ok) {
    const adapter = createAzureDiceAdapter(configured.config, async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(completedOutput) } }] }), { status: 200 });
    });
    await adapter.invoke({ providerAlias: DICE_AZURE_SERVER_ALIAS, promptVersion: "dice_v0_3_synthetic_prompt_2026_08_09", prompt: "fixture", language: "en", deadlineAtMs: Date.now() + 1000, maxOutputTokens: 300 });
  }
  equal(fetchCalls, 1, "adapter fetch is injected and test-local");
}

function gateway(adapter: DiceAzureAdapter): DiceSyntheticGateway {
  return new DiceSyntheticGateway(builtInDiceSyntheticRegistry, adapter, new DiceSyntheticRunBudget());
}

function sequenceAdapter(results: DiceProviderResult[]): DiceAzureAdapter & { calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    async invoke(input) {
      calls.push(input);
      return results.shift() ?? { kind: "invalid_output" };
    }
  };
}

function zeroEffects(value: { persistence_writes: number; units_charged: number }, label: string): void {
  equal(value.persistence_writes, 0, `${label} has zero persistence`);
  equal(value.units_charged, 0, `${label} has zero units`);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}
