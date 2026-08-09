import {
  DICE_AUTHORIZATION_SCHEMA,
  DICE_GATEWAY_INTERFACE_VERSION,
  canonicalDiceRegistry,
} from "./dice-synthetic-canonical-v1.ts";
import { diceServerTokenizer, measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";
import {
  createPostgresDiceAuthorityStore,
  type DiceAuthorityConsumption,
  type DiceAuthorityStore,
} from "./dice-authority-store-v1.ts";
import {
  DiceGatewayStop,
  DiceSyntheticGatewayPortV1,
  signDiceDeploymentAuthorization,
  verifyDiceGatewayDisabled,
  type DiceDeploymentAuthorization,
  type DiceProviderAdapter,
  type DiceProviderResult,
} from "./dice-synthetic-gateway-port-v1.ts";
import { DICE_AZURE_API_VERSION, createAzureDiceAdapter, readDiceAzureServerConfig } from "./azure-dice-adapter-v1.ts";

const SECRET = "test-only-authority-secret-32-bytes-minimum";
const PACKAGE_SHA = "a".repeat(64);
const REGISTRY_SHA = "b".repeat(64);
const NOW = Date.parse("2026-08-09T15:00:00.000Z");
const EN_OUTPUT = JSON.stringify({ reading: "Notice the measured opening.", watch_out: "Avoid certainty.", practical_direction: "Take one reversible step." });
const ZH_OUTPUT = JSON.stringify({ reading: "留意較平穩的開端。", watch_out: "避免過早下定論。", practical_direction: "先踏出可以回頭的一步。" });

runFixtures()
  .then(() => console.log("S2-T257 canonical Dice gateway port fixtures passed"))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "S2-T257 fixture failure");
    throw error;
  });

async function runFixtures(): Promise<void> {
  equal(canonicalDiceRegistry.technicalFixtures.length, 80, "canonical registry has exactly 80 Technical cases");
  equal(canonicalDiceRegistry.founderFixtureIds.length, 40, "canonical registry records 40 prohibited Founder IDs");
  equal(diceServerTokenizer.version, "o200k_base", "gpt-5-mini tokenizer vocabulary is fixed");
  equal(JSON.stringify(diceServerTokenizer.encode("hello")), JSON.stringify([24912]), "stable EN o200k token ID");
  equal(JSON.stringify(diceServerTokenizer.encode("你好🙂")), JSON.stringify([177519, 37459]), "stable zh-Hant and emoji o200k token IDs");
  equal(diceServerTokenizer.count("hello"), 1, "EN token count differs from characters and bytes");
  equal(diceServerTokenizer.count("你好🙂"), 2, "zh-Hant token count differs from characters and bytes");
  truthy(diceServerTokenizer.count("hello") !== [..."hello"].length && diceServerTokenizer.count("hello") !== new TextEncoder().encode("hello").length, "EN is not character or byte accounting");
  truthy(diceServerTokenizer.count("你好🙂") !== [..."你好🙂"].length && diceServerTokenizer.count("你好🙂") !== new TextEncoder().encode("你好🙂").length, "zh-Hant is not character or byte accounting");
  for (const [label, value, maximum] of [
    ["EN input", " hello".repeat(800), 800],
    ["zh-Hant input", " 星".repeat(800), 800],
    ["EN output", " hello".repeat(300), 300],
    ["zh-Hant output", " 星".repeat(300), 300],
  ] as const) {
    const atLimit = measureDiceTokenLimit(value, maximum);
    const overLimit = measureDiceTokenLimit(`${value}${label.startsWith("EN") ? " hello" : " 星"}`, maximum);
    equal(atLimit.token_count, maximum, `${label} exact boundary token count`);
    equal(atLimit.within_limit, true, `${label} exact boundary accepted`);
    equal(overLimit.token_count, maximum + 1, `${label} over-boundary token count`);
    equal(overLimit.within_limit, false, `${label} over-boundary rejected`);
  }

  let rpcName = "";
  let rpcParameters: Record<string, unknown> = {};
  const postgresStore = createPostgresDiceAuthorityStore({
    async rpc(name, parameters) {
      rpcName = name;
      rpcParameters = { ...parameters };
      return {
        data: {
          consumed: true,
          code: "consumed",
          run_id: parameters.p_run_id,
          consumed_at: new Date(NOW).toISOString(),
          retain_until: new Date(NOW + 30 * 86_400_000).toISOString(),
        },
        error: null,
      };
    },
  });
  const storeProbe: DiceAuthorityConsumption = {
    run_id: "dice-tech80-storeprobe000001",
    gateway_package_sha256: PACKAGE_SHA,
    fixture_registry_sha256: REGISTRY_SHA,
    authorization_hmac_sha256: "c".repeat(64),
    issued_at: new Date(NOW - 1000).toISOString(),
    valid_until: new Date(NOW + 60_000).toISOString(),
  };
  equal((await postgresStore.consume(storeProbe)).kind, "consumed", "concrete Postgres RPC store accepts a closed success result");
  equal(rpcName, "consume_lumis_dice_synthetic_authority_v1", "concrete store calls only the canonical consume RPC");
  equal(rpcParameters.p_run_id, storeProbe.run_id, "RPC binds exact run ID");
  equal(rpcParameters.p_gateway_package_sha256, PACKAGE_SHA, "RPC binds exact package SHA");
  equal(rpcParameters.p_fixture_registry_sha256, REGISTRY_SHA, "RPC binds exact registry SHA");

  let providerCalls = 0;
  let active = 0;
  let peak = 0;
  const successfulAdapter: DiceProviderAdapter = {
    async invoke(input) {
      providerCalls += 1;
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return { kind: "success", content: input.language === "en" ? EN_OUTPUT : ZH_OUTPUT };
    },
  };
  const successfulPort = port(successfulAdapter);
  truthy(verifyDiceGatewayDisabled(successfulPort.status()), "port is independently disabled before the window");
  const authorization = await authorizationFor("dice-tech80-successful000100");
  const evidencePackage = await successfulPort.executeAuthorizedWindow(authorization);
  equal(evidencePackage.technical_case_count, 80, "all Technical cases execute");
  equal(evidencePackage.founder_case_count, 0, "Founder execution is prohibited");
  equal(evidencePackage.records.length, 80, "evidence includes exactly 80 metadata records");
  truthy(providerCalls > 0 && providerCalls <= 160, "provider attempts remain inside the 160 cap");
  truthy(peak <= 2, "real worker execution stays within concurrency two");
  truthy(verifyDiceGatewayDisabled(successfulPort.status()), "port is independently disabled after success");
  for (const record of evidencePackage.records) {
    equal(record.phase, "technical", "evidence cannot label a Founder case");
    equal(record.effects.normal_routes, 0, "normal routes remain absent");
    equal(record.effects.units_charged, 0, "units remain absent");
    equal(record.effects.persistence_writes, 0, "persistence remains absent");
    equal(Date.parse(record.retain_until) - Date.parse(record.observed_at), 30 * 86_400_000, "metadata retention is exactly 30 days");
    for (const forbidden of ["question", "prompt", "content", "reading", "endpoint", "api_key", "secret"]) {
      equal(Object.hasOwn(record, forbidden), false, `metadata evidence excludes ${forbidden}`);
    }
  }

  await rejectsCode(() => successfulPort.executeAuthorizedWindow(authorization), "DICE_AUTHORITY_REPLAYED", "single-use run ID rejects replay");
  await rejectsCode(() => successfulPort.invokeFixture(), "DICE_DIRECT_FIXTURE_EXECUTION_PROHIBITED", "direct or Founder execution is unavailable");

  const sharedAtomicStore = new AtomicAuthorityStore();
  let crossInstanceCalls = 0;
  const crossInstanceAdapter: DiceProviderAdapter = {
    async invoke(input) {
      crossInstanceCalls += 1;
      return { kind: "success", content: input.language === "en" ? EN_OUTPUT : ZH_OUTPUT };
    },
  };
  const firstInstance = port(crossInstanceAdapter, sharedAtomicStore);
  const secondInstance = port(crossInstanceAdapter, sharedAtomicStore);
  const sharedAuthorization = await authorizationFor("dice-tech80-crossinstance001");
  const concurrent = await Promise.allSettled([
    firstInstance.executeAuthorizedWindow(sharedAuthorization),
    secondInstance.executeAuthorizedWindow(sharedAuthorization),
  ]);
  equal(concurrent.filter((result) => result.status === "fulfilled").length, 1, "two gateway instances produce one authority winner");
  equal(concurrent.filter((result) => result.status === "rejected" && result.reason instanceof DiceGatewayStop && result.reason.code === "DICE_AUTHORITY_REPLAYED").length, 1, "losing gateway instance is denied as replay");
  equal(sharedAtomicStore.size, 1, "shared atomic store has one durable authority row");
  equal(sharedAtomicStore.boundPackage(sharedAuthorization.single_use_run_id), PACKAGE_SHA, "atomic row retains exact package binding");
  truthy(crossInstanceCalls > 0 && crossInstanceCalls <= 160, "only the winning instance reaches provider attempts");

  let unavailableProviderCalls = 0;
  const unavailablePort = port(
    { async invoke() { unavailableProviderCalls += 1; return { kind: "success", content: EN_OUTPUT }; } },
    createPostgresDiceAuthorityStore({ async rpc() { return { data: null, error: { code: "PGRST_UNAVAILABLE" } }; } }),
  );
  const unavailableAuthorization = await authorizationFor("dice-tech80-storeoffline0001");
  await rejectsCode(() => unavailablePort.executeAuthorizedWindow(unavailableAuthorization), "DICE_AUTHORITY_STORE_UNAVAILABLE", "unavailable durable store fails closed");
  equal(unavailableProviderCalls, 0, "store failure prevents provider execution");
  truthy(verifyDiceGatewayDisabled(unavailablePort.status()), "store failure leaves provider disabled");

  const tampered = { ...await authorizationFor("dice-tech80-tampered00000100"), technical_case_count: 79 };
  await rejectsCode(() => port(successfulAdapter).executeAuthorizedWindow(tampered), "DICE_AUTHORITY_SCHEMA_INVALID", "hostile cap tampering fails closed");
  const extra = { ...await authorizationFor("dice-tech80-extrakey000000100"), question: "hostile member text" };
  await rejectsCode(() => port(successfulAdapter).executeAuthorizedWindow(extra), "DICE_AUTHORITY_SCHEMA_INVALID", "hostile extra field fails closed");
  const badSignature = { ...await authorizationFor("dice-tech80-badsignature00100"), authorization_hmac_sha256: "0".repeat(64) };
  await rejectsCode(() => port(successfulAdapter).executeAuthorizedWindow(badSignature), "DICE_AUTHORITY_SIGNATURE_INVALID", "forged authority fails closed");
  const expired = await authorizationFor("dice-tech80-expired000000100", NOW - 1);
  await rejectsCode(() => port(successfulAdapter).executeAuthorizedWindow(expired), "DICE_AUTHORITY_EXPIRED_OR_OVERBROAD", "expired authority fails closed");
  let movingNow = NOW;
  const expiringPort = new DiceSyntheticGatewayPortV1(
    { async invoke(input) { movingNow = NOW + 2; return { kind: "success", content: input.language === "en" ? EN_OUTPUT : ZH_OUTPUT }; } },
    new AtomicAuthorityStore(),
    SECRET,
    { gatewayPackageSha256: PACKAGE_SHA, fixtureRegistrySha256: REGISTRY_SHA },
    { now: () => movingNow },
  );
  const expiringAuthorization = await authorizationFor("dice-tech80-midexpiry0001000", NOW + 1);
  await rejectsCode(() => expiringPort.executeAuthorizedWindow(expiringAuthorization), "DICE_AUTHORITY_EXPIRED_DURING_RUN", "authority expiry during a run stops execution");
  truthy(verifyDiceGatewayDisabled(expiringPort.status()), "mid-run expiry disables immediately");

  const exact300 = { en: exactOutput("en", 300), "zh-Hant": exactOutput("zh-Hant", 300) };
  const exact301 = { en: exactOutput("en", 301), "zh-Hant": exactOutput("zh-Hant", 301) };
  const boundaryPort = port({ async invoke(input) { return { kind: "success", content: exact300[input.language] }; } });
  const boundary = await boundaryPort.executeAuthorizedWindow(await authorizationFor("dice-tech80-outputedge000100"));
  truthy(boundary.records.some((record) => record.result_class === "completed" && record.output_tokens === 300), "actual o200k 300-token provider output is accepted");
  const capPort = port({ async invoke(input) { return { kind: "success", content: exact301[input.language] }; } });
  const capped = await capPort.executeAuthorizedWindow(await authorizationFor("dice-tech80-outputcap0000100"));
  truthy(capped.records.some((record) => record.output_tokens === 301 && record.redacted_failure_code === "output_token_cap"), "actual o200k 301-token provider output is rejected");

  let retryCalls = 0;
  const retryPort = port({ async invoke(): Promise<DiceProviderResult> { retryCalls += 1; return { kind: "network" }; } });
  const retried = await retryPort.executeAuthorizedWindow(await authorizationFor("dice-tech80-retrycap00000100"));
  truthy(retried.records.every((record) => record.attempt_count <= 2), "one retry maximum is enforced per case");
  truthy(retryCalls <= 160 && retried.attempt_total <= 160, "global provider attempts cannot exceed 160");

  let fatalClock = false;
  const fatalPort = new DiceSyntheticGatewayPortV1(
    { invoke: async () => { fatalClock = true; return new Promise<DiceProviderResult>(() => {}); } },
    new AtomicAuthorityStore(),
    SECRET,
    { gatewayPackageSha256: PACKAGE_SHA, fixtureRegistrySha256: REGISTRY_SHA },
    { now: () => { if (fatalClock) throw new Error("fixture clock failure"); return NOW; } },
  );
  const fatalAuthorization = await authorizationFor("dice-tech80-fataldisable00100");
  await rejects(() => fatalPort.executeAuthorizedWindow(fatalAuthorization), "fatal execution rejects");
  truthy(verifyDiceGatewayDisabled(fatalPort.status()), "finally disables after fatal execution");

  for (const endpoint of ["https://example.com", "https://lumis.openai.azure.com.attacker.test", "http://lumis.openai.azure.com", "https://lumis.openai.azure.com/path"]) {
    const result = readDiceAzureServerConfig(serverEnvironment(endpoint));
    equal(result.ok, false, `arbitrary endpoint rejected: ${endpoint}`);
  }
  const config = readDiceAzureServerConfig(serverEnvironment("https://lumis-staging.openai.azure.com"));
  truthy(config.ok, "exact allow-listed Azure OpenAI hostname accepted");
  if (config.ok) {
    equal(config.config.apiVersion, DICE_AZURE_API_VERSION, "Azure API version is fixed in source");
    let fetchUrl = "";
    const adapter = createAzureDiceAdapter(config.config, async (input) => {
      fetchUrl = String(input);
      return new Response(JSON.stringify({ choices: [{ message: { content: EN_OUTPUT } }] }), { status: 200 });
    });
    await adapter.invoke({ prompt: "fixture", prompt_version: "lumis_dice_synthetic_prompt_v1", language: "en", deadline_at_ms: Date.now() + 1000, max_output_tokens: 300, signal: new AbortController().signal });
    truthy(fetchUrl.endsWith(`api-version=${DICE_AZURE_API_VERSION}`), "adapter cannot accept an arbitrary API version");
  }
}

function port(adapter: DiceProviderAdapter, authorityStore: DiceAuthorityStore = new AtomicAuthorityStore()): DiceSyntheticGatewayPortV1 {
  return new DiceSyntheticGatewayPortV1(adapter, authorityStore, SECRET, { gatewayPackageSha256: PACKAGE_SHA, fixtureRegistrySha256: REGISTRY_SHA }, { now: () => NOW });
}

function exactOutput(language: "en" | "zh-Hant", target: number): string {
  const unit = language === "en" ? " hello" : " 星";
  for (let repeats = 0; repeats <= target * 2; repeats += 1) {
    const content = JSON.stringify({
      reading: unit.repeat(repeats).trim(),
      watch_out: language === "en" ? "Avoid certainty." : "避免過早下定論。",
      practical_direction: language === "en" ? "Take one reversible step." : "先踏出可以回頭的一步。",
    });
    if (diceServerTokenizer.count(content) === target) return content;
  }
  throw new Error(`unable to build ${language} output with ${target} o200k tokens`);
}

async function authorizationFor(runId: string, validUntil = NOW + 60_000): Promise<DiceDeploymentAuthorization> {
  return signDiceDeploymentAuthorization({
    schema: DICE_AUTHORIZATION_SCHEMA,
    interface_version: DICE_GATEWAY_INTERFACE_VERSION,
    authorization_scope: "technical_80_only",
    single_use_run_id: runId,
    issued_at: new Date(NOW - 1000).toISOString(),
    valid_until: new Date(validUntil).toISOString(),
    gateway_package_sha256: PACKAGE_SHA,
    fixture_registry_sha256: REGISTRY_SHA,
    technical_case_count: 80,
    founder_execution: false,
  }, SECRET);
}

class AtomicAuthorityStore implements DiceAuthorityStore {
  private readonly rows = new Map<string, DiceAuthorityConsumption>();

  get size(): number { return this.rows.size; }

  boundPackage(runId: string): string | undefined { return this.rows.get(runId)?.gateway_package_sha256; }

  async consume(input: DiceAuthorityConsumption) {
    if (this.rows.has(input.run_id)) return { kind: "replayed" as const };
    this.rows.set(input.run_id, Object.freeze({ ...input }));
    await Promise.resolve();
    return Object.freeze({
      kind: "consumed" as const,
      run_id: input.run_id,
      consumed_at: new Date(NOW).toISOString(),
      retain_until: new Date(NOW + 30 * 86_400_000).toISOString(),
    });
  }
}

function serverEnvironment(endpoint: string): Record<string, string> {
  return {
    LUMIS_DICE_AI_ENABLED: "true",
    LUMIS_DICE_AZURE_ENDPOINT: endpoint,
    LUMIS_DICE_AZURE_API_KEY: "test-only-not-a-secret",
    LUMIS_DICE_AZURE_ALLOWED_HOSTNAMES: "lumis-staging.openai.azure.com",
  };
}

async function rejectsCode(callback: () => Promise<unknown>, code: string, label: string): Promise<void> {
  try { await callback(); } catch (error) {
    equal(error instanceof DiceGatewayStop ? error.code : "", code, label);
    return;
  }
  throw new Error(`${label}: expected rejection`);
}

async function rejects(callback: () => Promise<unknown>, label: string): Promise<void> {
  try { await callback(); } catch { return; }
  throw new Error(`${label}: expected rejection`);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function truthy(value: unknown, label: string): void {
  if (!value) throw new Error(`${label}: assertion failed`);
}
