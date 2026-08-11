import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = (file) => path.join(root, ".tmp/dice-synthetic-edge-v1-tests/supabase/functions", file);
const { createDiceSyntheticEdgeHandler, DICE_EDGE_PACKAGE_SHA256, DICE_EDGE_REGISTRY_SHA256 } = await import(compiled("dice-synthetic/edge-handler-v1.js"));
const {
  DICE_AZURE_API_VERSION, DICE_AZURE_DEPLOYMENT, DICE_AZURE_DEPLOYMENT_TYPE, DICE_AZURE_GUARDRAIL,
  DICE_AZURE_HOSTNAME, DICE_AZURE_LIMITS, DICE_AZURE_MODEL, DICE_AZURE_MODEL_VERSION,
  DICE_AZURE_ROUTE_FAMILY, DICE_AZURE_UPGRADE_POLICY, createAzureDiceAdapter,
} = await import(compiled("_shared/azure-dice-adapter-v1.js"));
const { DiceSyntheticGatewayPortV1, signDiceDeploymentAuthorization } = await import(compiled("_shared/dice-synthetic-gateway-port-v1.js"));

const SECRET = "local-emulator-authority-secret-32-bytes-minimum";
const LOCAL_CREDENTIAL = crypto.randomUUID();
const EN = JSON.stringify({ reading: "Notice the measured opening.", watch_out: "Avoid certainty.", practical_direction: "Take one reversible step." });
const ZH = JSON.stringify({ reading: "留意較平穩的開端。", watch_out: "避免過早下定論。", practical_direction: "先踏出可以回頭的一步。" });
const state = { mode: "success", calls: 0 };
const strictOrigin = `https://${DICE_AZURE_HOSTNAME}`;
const transport = async (input, init) => {
  state.calls += 1;
  const body = JSON.parse(String(init?.body));
  assert.equal(init?.method, "POST");
  assert.equal(new Headers(init?.headers).get("api-key"), LOCAL_CREDENTIAL);
  const requestUrl = new URL(String(input));
  assert.equal(requestUrl.origin, strictOrigin);
  assert.equal(requestUrl.pathname, "/openai/v1/responses");
  assert.equal(requestUrl.search, "");
  assert.deepEqual(Object.keys(body).sort(), ["input", "max_output_tokens", "model", "store"]);
  assert.equal(body.max_output_tokens, 300);
  assert.equal(body.model, DICE_AZURE_DEPLOYMENT);
  assert.equal(body.store, false);

  if (state.mode === "timeout") {
    await new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
  }
  if (state.mode === "transient-once" && state.calls === 1) return json(500, { error: { code: "local_transient" } });
  if (state.mode === "block") return json(400, { error: { code: "content_filter" } });
  if (state.mode === "partial") return json(200, { status: "incomplete", incomplete_details: { reason: "content_filter" } });
  if (state.mode === "malformed") return json(200, { status: "completed", output_text: "not-json" });
  if (state.mode === "401" || state.mode === "403") return json(Number(state.mode), { error: { code: "redacted" } });
  const prompt = body.input;
  const content = state.mode === "oversized"
    ? JSON.stringify({ reading: " hello".repeat(301), watch_out: "Avoid certainty.", practical_direction: "Pause." })
    : prompt.includes("language=zh-Hant") ? ZH : EN;
  return json(200, { status: "completed", output_text: content });
};

assert.deepEqual({
    deploymentAlias: DICE_AZURE_DEPLOYMENT,
    model: DICE_AZURE_MODEL,
    version: DICE_AZURE_MODEL_VERSION,
    deploymentType: DICE_AZURE_DEPLOYMENT_TYPE,
    upgradePolicy: DICE_AZURE_UPGRADE_POLICY,
    guardrail: DICE_AZURE_GUARDRAIL,
    limits: DICE_AZURE_LIMITS,
    hostname: DICE_AZURE_HOSTNAME,
    apiVersion: DICE_AZURE_API_VERSION,
    routeFamily: DICE_AZURE_ROUTE_FAMILY,
  }, {
    deploymentAlias: "lumis-ai-chat-stg",
    model: "gpt-5-mini",
    version: "2025-08-07",
    deploymentType: "GlobalStandard",
    upgradePolicy: "NoAutoUpgrade",
    guardrail: "Microsoft.DefaultV2",
    limits: { tokensPerMinute: 10_000, requestsPerMinute: 10 },
    hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
    apiVersion: null,
    routeFamily: "v1",
  });
  for (const routeFamily of ["preview", "2025-08-07"]) {
    assert.throws(() => createAzureDiceAdapter({ ...localProviderConfig(), routeFamily }, transport), /DICE_AZURE_PROTOCOL_CONFIGURATION_INVALID/);
  }
  await disabledProbes();
  const baseline = await runWindow("success", "successful000001");
  assert.ok(baseline.body.records.some((record) => record.result_class === "completed"));
  assertMetadataOnly(baseline.body);

  for (const [mode, code] of [["block", "defaultv2_block"], ["partial", "defaultv2_partial"], ["malformed", "provider_malformed"]]) {
    const result = await runWindow(mode, `${mode.replace("-", "")}000000001`);
    assert.ok(result.body.records.some((record) => record.redacted_failure_code === code), `${mode} maps to ${code}`);
  }

  for (const mode of ["401", "403"]) {
    const result = await runWindow(mode, `status${mode}0000000001`);
    assert.equal(state.calls, baseline.providerCalls, `${mode} is never retried`);
    assert.ok(result.body.records.filter((record) => record.attempt_count > 0).every((record) => record.attempt_count === 1));
  }

  const transient = await runWindow("transient-once", "transientonce000001");
  assert.equal(state.calls, baseline.providerCalls + 1, "one transient failure receives one retry");
  assert.ok(transient.body.records.some((record) => record.attempt_count === 2 && record.result_class === "completed"));

  const oversized = await runWindow("oversized", "oversized000000001");
  assert.ok(oversized.body.records.some((record) => record.redacted_failure_code === "output_token_cap"));

  state.mode = "timeout";
  state.calls = 0;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  const timeout = await createAzureDiceAdapter(localProviderConfig(), transport).invoke({
    prompt: "fixture", prompt_version: "lumis_dice_synthetic_prompt_v1", language: "en",
    deadline_at_ms: Date.now() + 1000, max_output_tokens: 300, signal: controller.signal,
  });
  assert.deepEqual(timeout, { kind: "timeout" });
  assert.equal(state.calls, 1);
console.log("S2_T263_LOCAL_AZURE_PROTOCOL_OK transport=network-disabled scenarios=success,block,partial,malformed,401,403,transient-once,timeout,oversized");

async function disabledProbes() {
  for (const [enabled, code] of [[undefined, "DICE_AI_DISABLED"], ["false", "DICE_AI_DISABLED"], ["true", "DICE_AZURE_TRAFFIC_AUTHORITY_MISSING"]]) {
    let authorityClients = 0;
    let providerCalls = 0;
    const handler = createDiceSyntheticEdgeHandler({
      environment: environment(enabled),
      createAuthorityClient() { authorityClients += 1; throw new Error("must not construct"); },
      fetchImpl: async () => { providerCalls += 1; throw new Error("must not fetch"); },
    });
    const response = await handler(new Request("http://edge.local/dice-synthetic", { method: "POST", body: "{}" }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code } });
    assert.equal(authorityClients, 0);
    assert.equal(providerCalls, 0);
  }
}

async function runWindow(mode, runSuffix) {
  state.mode = mode;
  state.calls = 0;
  const now = Date.now();
  const authorization = await signDiceDeploymentAuthorization({
    schema: "lumis_dice_default_off_deployment_authorization_v2",
    interface_version: "dice_synthetic_gateway_port_v1",
    authorization_scope: "technical_80_only",
    single_use_run_id: `dice-tech80-${runSuffix.padEnd(16, "0")}`,
    issued_at: new Date(now - 1000).toISOString(),
    valid_until: new Date(now + 10 * 60_000).toISOString(),
    gateway_package_sha256: DICE_EDGE_PACKAGE_SHA256,
    fixture_registry_sha256: DICE_EDGE_REGISTRY_SHA256,
    technical_case_count: 80,
    founder_execution: false,
  }, SECRET);
  const gateway = new DiceSyntheticGatewayPortV1(
    createAzureDiceAdapter(localProviderConfig(), transport),
    { async consume(input) {
      return { kind: "consumed", run_id: input.run_id, consumed_at: new Date(now).toISOString(), retain_until: new Date(now + 30 * 86_400_000).toISOString() };
    } },
    SECRET,
    { gatewayPackageSha256: DICE_EDGE_PACKAGE_SHA256, fixtureRegistrySha256: DICE_EDGE_REGISTRY_SHA256 },
  );
  const body = await gateway.executeAuthorizedWindow(authorization);
  return { body, providerCalls: state.calls };
}

function localProviderConfig() {
  return {
    endpoint: strictOrigin,
    apiKey: LOCAL_CREDENTIAL,
    deployment: DICE_AZURE_DEPLOYMENT,
    routeFamily: "v1",
  };
}

function environment(...arguments_) {
  const enabled = arguments_.length === 0 ? "true" : arguments_[0];
  return {
    LUMIS_DICE_AI_ENABLED: enabled,
    LUMIS_DICE_TRAFFIC_AUTHORIZED: "false",
    LUMIS_DICE_AZURE_API_KEY: LOCAL_CREDENTIAL,
    LUMIS_DICE_AUTHORITY_HMAC_SECRET: SECRET,
    LUMIS_DICE_DEPLOYMENT_ALIAS: "lumis-ai-chat-stg",
    LUMIS_DICE_MODEL: "gpt-5-mini",
    LUMIS_DICE_MODEL_VERSION: "2025-08-07",
    LUMIS_DICE_DEPLOYMENT_TYPE: "GlobalStandard",
    LUMIS_DICE_UPGRADE_POLICY: "NoAutoUpgrade",
    LUMIS_DICE_GUARDRAIL: "Microsoft.DefaultV2",
    LUMIS_DICE_TPM_LIMIT: "10000",
    LUMIS_DICE_RPM_LIMIT: "10",
    LUMIS_DICE_FOUNDRY_HOSTNAME: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
    LUMIS_DICE_FOUNDRY_PROTOCOL: "https",
    LUMIS_DICE_API_ROUTE_FAMILY: "v1",
    SUPABASE_URL: "https://local-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "local-service-role-placeholder",
  };
}

function assertMetadataOnly(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of ["question=", "api-key", LOCAL_CREDENTIAL, "service-role", "member_id", "units_consumed"]) assert.equal(serialized.includes(forbidden), false);
  for (const record of value.records) {
    assert.equal(Date.parse(record.retain_until) - Date.parse(record.observed_at), 30 * 86_400_000);
    assert.deepEqual(record.effects, { normal_routes: 0, units_charged: 0, persistence_writes: 0 });
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
