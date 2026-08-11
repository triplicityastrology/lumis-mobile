import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = (file) => path.join(root, ".tmp/dice-synthetic-edge-v1-tests/supabase/functions", file);
const { createDiceSyntheticEdgeHandler, DICE_EDGE_PACKAGE_SHA256, DICE_EDGE_REGISTRY_SHA256 } =
  await import(compiled("dice-synthetic/edge-handler-v1.js"));
const { signDiceDeploymentAuthorization } =
  await import(compiled("_shared/dice-synthetic-gateway-port-v1.js"));

const NOW = Date.now();
const SECRET = "local-wrapper-ledger-authority-secret-32-bytes";
const RUN_ID = "dice-tech80-wrapperledger0001";
const ledger = new Map();
let rpcCalls = 0;
let providerCalls = 0;
let authorityClients = 0;

const handler = createDiceSyntheticEdgeHandler({
  environment: runtimeEnvironment(),
  createAuthorityClient(url, serviceRoleKey) {
    authorityClients += 1;
    assert.equal(url, "https://local-project.supabase.co");
    assert.equal(serviceRoleKey, "local-service-role-placeholder");
    return {
      async rpc(name, parameters) {
        rpcCalls += 1;
        assert.equal(name, "consume_lumis_dice_synthetic_authority_v1");
        assert.deepEqual(Object.keys(parameters).sort(), [
          "p_authorization_hmac_sha256", "p_fixture_registry_sha256", "p_gateway_package_sha256",
          "p_issued_at", "p_run_id", "p_valid_until",
        ]);
        if (ledger.has(parameters.p_run_id)) {
          return { data: { consumed: false, code: "replayed", run_id: parameters.p_run_id, consumed_at: null, retain_until: null }, error: null };
        }
        ledger.set(parameters.p_run_id, Object.freeze({ ...parameters }));
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
    };
  },
  async fetchImpl(input, init) {
    providerCalls += 1;
    assert.equal(String(input), "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com/openai/v1/responses");
    assert.equal(init?.method, "POST");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "lumis-ai-chat-stg");
    assert.equal(request.store, false);
    const output = String(request.input).includes("language=zh-Hant")
      ? { reading: "留意當下的節奏。", watch_out: "避免過早下結論。", practical_direction: "先做一個可逆的小步驟。" }
      : { reading: "Notice the current rhythm.", watch_out: "Avoid premature certainty.", practical_direction: "Take one reversible step." };
    return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify(output) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});

const authorization = await signDiceDeploymentAuthorization({
  schema: "lumis_dice_default_off_deployment_authorization_v2",
  interface_version: "dice_synthetic_gateway_port_v1",
  authorization_scope: "technical_80_only",
  single_use_run_id: RUN_ID,
  issued_at: new Date(NOW - 1_000).toISOString(),
  valid_until: new Date(NOW + 60_000).toISOString(),
  gateway_package_sha256: DICE_EDGE_PACKAGE_SHA256,
  fixture_registry_sha256: DICE_EDGE_REGISTRY_SHA256,
  technical_case_count: 80,
  founder_execution: false,
}, SECRET);

const first = await handler(requestFor(authorization));
assert.equal(first.status, 200);
const evidence = await first.json();
assert.equal(evidence.technical_case_count, 80);
assert.equal(evidence.founder_case_count, 0);
assert.equal(evidence.records.length, 80);
assert.equal(evidence.provider_disabled_verified, true);
assert(providerCalls > 0 && providerCalls <= 160);
assert.equal(rpcCalls, 1);
assert.equal(authorityClients, 1);
assert.equal(ledger.size, 1);
assert.equal(ledger.get(RUN_ID).p_gateway_package_sha256, DICE_EDGE_PACKAGE_SHA256);
assert.equal(ledger.get(RUN_ID).p_fixture_registry_sha256, DICE_EDGE_REGISTRY_SHA256);

const replay = await handler(requestFor(authorization));
assert.equal(replay.status, 409);
assert.deepEqual(await replay.json(), { error: { code: "DICE_AUTHORITY_REPLAYED" } });
assert.equal(providerCalls, evidence.attempt_total);
assert.equal(rpcCalls, 2);
assert.equal(ledger.size, 1);

const serialized = JSON.stringify(evidence);
for (const prohibited of [SECRET, "local-service-role-placeholder", "api-key", "prompt", "response", "member_id", "account_id"]) {
  assert.equal(serialized.includes(prohibited), false, `evidence leaked ${prohibited}`);
}

console.log(`S2_T267_WRAPPER_LEDGER_INTEGRATION_OK records=${evidence.records.length} attempts=${evidence.attempt_total} ledger_rows=${ledger.size}`);

function requestFor(authorizationValue) {
  return new Request("http://edge.local/dice-synthetic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorization: authorizationValue }),
  });
}

function runtimeEnvironment() {
  return {
    LUMIS_DICE_AI_ENABLED: "true",
    LUMIS_DICE_TRAFFIC_AUTHORIZED: "true",
    LUMIS_DICE_AZURE_API_KEY: "local-emulator-key",
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
