import { createAzureDiceAdapter, diceResultJsonSchema } from "../_shared/azure-dice-adapter-v1.ts";
import { createDiceSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const environment = {
  LUMIS_DICE_AI_ENABLED: "true", LUMIS_DICE_TRAFFIC_AUTHORIZED: "true", LUMIS_DICE_AZURE_API_KEY: "synthetic-test-key",
  LUMIS_DICE_AUTHORITY_HMAC_SECRET: "synthetic-authority-secret-at-least-32-characters",
  LUMIS_DICE_DEPLOYMENT_ALIAS: "lumis-ai-chat-stg", LUMIS_DICE_MODEL: "gpt-5-mini", LUMIS_DICE_MODEL_VERSION: "2025-08-07",
  LUMIS_DICE_DEPLOYMENT_TYPE: "GlobalStandard", LUMIS_DICE_UPGRADE_POLICY: "NoAutoUpgrade", LUMIS_DICE_GUARDRAIL: "Microsoft.DefaultV2",
  LUMIS_DICE_TPM_LIMIT: "10000", LUMIS_DICE_RPM_LIMIT: "10", LUMIS_DICE_FOUNDRY_HOSTNAME: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
  LUMIS_DICE_FOUNDRY_PROTOCOL: "https", LUMIS_DICE_API_ROUTE_FAMILY: "v1", SUPABASE_URL: "https://local.invalid", SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
  LUMIS_DICE_FOUNDER_WINDOW_PUBLIC_KEY_PEM: "test-public-key",
  LUMIS_DICE_FOUNDER_FREE_TEXT_ENABLED: "true",
  LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY: "founder-free-text-test-access-key-0001",
};
const receipt = { single_use_window_id: "dice-founder40-abcdefghijklmnop", valid_until: new Date(Date.now() + 600000).toISOString(), request_sha256: "a".repeat(64) };
const result = { schema: "lumis_dice_v0_3_result_v2", language: "en", planet_layer: "Venus centers shared value.", sign_element_layer: "Libra expresses balance and an airy social atmosphere.", house_layer: "The 7th House places this in the external environment of partnership.", timing_or_pace: null, judgment: null, practical_direction: "Name one practical expectation before the next conversation." };
let providerCalls = 0;
let receiptChecks = 0;
let authorityMode: "consumed" | "replayed" = "consumed";
const handler = createDiceSyntheticEdgeHandler({
  environment,
  verifyFounderReceipt: async () => { receiptChecks += 1; return { receipt, receiptSha256: "b".repeat(64) }; },
  createAuthorityClient: () => ({ async rpc(name) { return name.startsWith("consume_") ? { data: authorityMode === "consumed" ? { consumed: true } : { consumed: false }, error: null } : { data: { released: true }, error: null }; } }),
  fetchImpl: async (_url, init) => {
    providerCalls += 1;
    const providerRequest = JSON.parse(String(init?.body));
    check(providerRequest.text?.format?.type === "json_schema" && providerRequest.text.format.name === "lumis_dice_v0_3_result_v2" && providerRequest.text.format.strict === true, "Founder wrapper requests the strict v2 schema");
    check(providerRequest.reasoning?.effort === "minimal" && providerRequest.text?.verbosity === "low" && providerRequest.max_output_tokens === 300, "Founder wrapper reserves the capped output budget for concise validated text");
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const founderHeaders = { "content-type": "application/json", "x-lumis-founder-window-authorization": "closed-test-receipt", "x-lumis-founder-window-receipt-sha256": "b".repeat(64) };
const selected = { fixture_id: "dice-founder-en-01", planet_id: "venus", sign_id: "libra", house_id: "house_7" };

function keys(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>).sort() : [];
}

function assertShapeSchema() {
  const expectedKeys = ["house_layer", "judgment", "language", "planet_layer", "practical_direction", "schema", "sign_element_layer", "timing_or_pace"];
  for (const [language, shape] of [["en", "judgment"], ["zh-Hant", "timing"], ["en", "descriptive"]] as const) {
    const schema = diceResultJsonSchema(language, shape);
    check(schema.additionalProperties === false && JSON.stringify([...schema.required].sort()) === JSON.stringify(expectedKeys), `${shape} schema has exactly eight required keys`);
    check(JSON.stringify(keys(schema.properties)) === JSON.stringify(expectedKeys), `${shape} schema exposes exactly eight properties`);
    check(schema.properties.language.const === language, `${shape} schema pins the requested language`);
    for (const field of ["planet_layer", "sign_element_layer", "house_layer", "practical_direction"] as const) {
      check(schema.properties[field].type === "string" && schema.properties[field].minLength === 1, `${shape} schema requires non-empty ${field}`);
    }
    if (shape === "judgment") {
      check(schema.properties.judgment.type === "string" && schema.properties.judgment.minLength === 1 && schema.properties.timing_or_pace.type === "null", "judgment schema requires judgment and null timing");
    } else if (shape === "timing") {
      check(schema.properties.timing_or_pace.type === "string" && schema.properties.timing_or_pace.minLength === 1 && schema.properties.judgment.type === "null", "timing schema requires timing and null judgment");
    } else {
      check(schema.properties.timing_or_pace.type === "null" && schema.properties.judgment.type === "null", "other schemas require null timing and judgment");
    }
  }
}

async function main() {
  assertShapeSchema();
  await assertProviderDispositions();
  await assertFounderFreeTextBoundary();
  const success = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify(selected) }));
  const successBody = await success.json();
  check(success.status === 200 && successBody.result?.schema === "lumis_dice_v0_3_result_v2" && successBody.metadata?.fixture_id === selected.fixture_id && successBody.protected_metadata?.provider_disposition === "responses_completed_valid", "Founder wrapper returns validated v2 plus protected disposition");
  check(providerCalls === 1 && receiptChecks === 1, "exact Founder route reaches one provider call after receipt and ledger");

  const sdkProjectionHandler = createDiceSyntheticEdgeHandler({
    environment,
    verifyFounderReceipt: async () => ({ receipt, receiptSha256: "b".repeat(64) }),
    createAuthorityClient: () => ({ async rpc(name) { return { data: name.startsWith("consume_") ? { consumed: true } : { released: true }, error: null }; } }),
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify(result) }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const sdkProjection = await sdkProjectionHandler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify(selected) }));
  check(sdkProjection.status === 200, "SDK output_text projection remains compatible");

  let retryCalls = 0;
  const retryHandler = createDiceSyntheticEdgeHandler({
    environment,
    verifyFounderReceipt: async () => ({ receipt, receiptSha256: "b".repeat(64) }),
    createAuthorityClient: () => ({ async rpc(name) { return { data: name.startsWith("consume_") ? { consumed: true } : { released: true }, error: null }; } }),
    fetchImpl: async () => {
      retryCalls += 1;
      return retryCalls === 1
        ? new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const retried = await retryHandler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify(selected) }));
  check(retried.status === 200 && retryCalls === 2, "incomplete max-output receives exactly one eligible retry within the shared deadline");

  const diagnosticHandler = createDiceSyntheticEdgeHandler({
    environment,
    verifyFounderReceipt: async () => ({ receipt, receiptSha256: "b".repeat(64) }),
    createAuthorityClient: () => ({ async rpc(name) { return { data: name.startsWith("consume_") ? { consumed: true } : { released: true }, error: null }; } }),
    fetchImpl: async () => new Response("upstream detail must not escape", { status: 401, headers: { "x-provider-secret": "forbidden" } }),
  });
  const diagnostic = await diagnosticHandler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify({ ...selected, fixture_id: "dice-founder-en-02" }) }));
  const diagnosticBody = await diagnostic.json();
  check(diagnostic.status === 422, "Founder provider failure projects a stable non-success status");
  check(JSON.stringify(keys(diagnosticBody)) === JSON.stringify(["error"]), "diagnostic envelope has one closed top-level field");
  check(JSON.stringify(keys(diagnosticBody.error)) === JSON.stringify(["code", "redacted_failure_code"]), "diagnostic error contains only stable and redacted codes");
  check(diagnosticBody.error.code === "DICE_FIXED_FALLBACK" && diagnosticBody.error.redacted_failure_code === "DICE_AUTHENTICATION", "authentication maps to a closed redacted failure code");
  check(!/(upstream|provider-secret|status|url|header|response|credential)/iu.test(JSON.stringify(diagnosticBody)), "diagnostic envelope excludes upstream and provider details");

  const authorityFailureHandler = createDiceSyntheticEdgeHandler({
    environment,
    verifyFounderReceipt: async () => ({ receipt, receiptSha256: "b".repeat(64) }),
    createAuthorityClient: () => ({ async rpc() { return { data: { consumed: false }, error: null }; } }),
    fetchImpl: async () => { throw new Error("provider must not be constructed after authority denial"); },
  });
  const authorityFailure = await authorityFailureHandler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify({ ...selected, fixture_id: "dice-founder-en-03" }) }));
  const authorityFailureBody = await authorityFailure.json();
  check(authorityFailure.status === 422 && authorityFailureBody.error?.code === "DICE_FIXED_FALLBACK" && authorityFailureBody.error?.redacted_failure_code === "DICE_FOUNDER_AUTHORITY_REJECTED", "authority denial remains a closed, provider-free diagnostic");

  const beforeInvalid = providerCalls;
  const invalid = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify({ ...selected, planet_id: "chiron" }) }));
  check(invalid.status === 400 && providerCalls === beforeInvalid && receiptChecks === 1, "invalid allow-list value stops before receipt/provider construction");

  authorityMode = "replayed";
  const replay = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers: founderHeaders, body: JSON.stringify({ ...selected, fixture_id: "dice-founder-en-02" }) }));
  const replayBody = await replay.json();
  check(replay.status === 422 && replayBody.error?.redacted_failure_code === "DICE_FOUNDER_AUTHORITY_REJECTED" && providerCalls === beforeInvalid, "replayed/denied ledger case stops before provider");

  const technicalShape = await handler(new Request("http://local/dice-synthetic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ authorization: null, extra: true }) }));
  check(technicalShape.status === 400, "technical branch remains closed to authorization only");
  console.log("Founder Dice Edge wrapper integration passed: closed IDs, receipt, ledger, v2 result, replay stop, zero network");
}

async function assertFounderFreeTextBoundary() {
  let calls = 0;
  let authorityConstructions = 0;
  const freeTextHandler = createDiceSyntheticEdgeHandler({
    environment,
    createAuthorityClient: () => {
      authorityConstructions += 1;
      throw new Error("free text must not construct the authority store");
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const headers = { "content-type": "application/json", "x-lumis-founder-free-text-access": environment.LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY };
  const valid = { question: "What should I understand about this working relationship?", planet_id: "venus", sign_id: "libra", house_id: "house_7" };

  const invalid = await freeTextHandler(new Request("http://local/dice-synthetic", { method: "POST", headers, body: JSON.stringify({ ...valid, planet_id: "chiron" }) }));
  check(invalid.status === 400 && calls === 0 && authorityConstructions === 0, "invalid free-text face stops before provider and authority construction");

  const denied = await freeTextHandler(new Request("http://local/dice-synthetic", { method: "POST", headers: { ...headers, "x-lumis-founder-free-text-access": "wrong-access-key-that-is-long-enough-000" }, body: JSON.stringify(valid) }));
  check(denied.status === 403 && calls === 0 && authorityConstructions === 0, "invalid Founder access stops before provider and authority construction");

  const rejected = await freeTextHandler(new Request("http://local/dice-synthetic", { method: "POST", headers, body: JSON.stringify({ ...valid, question: "hi" }) }));
  const rejectedBody = await rejected.json();
  check(rejected.status === 422 && rejectedBody.classification?.accepted === false && calls === 0 && authorityConstructions === 0, "deterministic rejection stops before provider construction");

  const completed = await freeTextHandler(new Request("http://local/dice-synthetic", { method: "POST", headers, body: JSON.stringify(valid) }));
  const completedBody = await completed.json();
  check(completed.status === 200 && completedBody.result?.schema === "lumis_dice_v0_3_result_v2", "valid free text returns the strict v2 result");
  check(completedBody.classification?.accepted === true && completedBody.metadata?.request_mode === "founder_free_text", "classification and metadata remain server-owned");
  check(calls === 1 && authorityConstructions === 0, "valid free text makes one provider call without fixture authority persistence");
}

async function assertProviderDispositions() {
  const config = { endpoint: "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com", apiKey: "synthetic-test-key", deployment: "lumis-ai-chat-stg", routeFamily: "v1" } as const;
  const cases = [
    ["http_400_text_format_schema", new Response(JSON.stringify({ error: { code: "invalid_request_error", param: "text.format.schema", message: "must never be retained" } }), { status: 400 })],
    ["http_non_2xx", new Response(JSON.stringify({ error: { code: "other", param: "other", message: "must never be retained" } }), { status: 422 })],
    ["responses_incomplete_content_filter", new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "content_filter", detail: "must never be retained" } }), { status: 200 })],
    ["responses_incomplete_max_output", new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens", detail: "must never be retained" } }), { status: 200 })],
    ["responses_incomplete_other", new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "other", detail: "must never be retained" } }), { status: 200 })],
    ["responses_completed_empty_output", new Response(JSON.stringify({ status: "completed", output: [] }), { status: 200 })],
    ["responses_completed_non_text_output", new Response(JSON.stringify({ status: "completed", output: [{ type: "reasoning", content: [] }] }), { status: 200 })],
    ["responses_completed_schema_invalid", new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not-json" }] }] }), { status: 200 })],
    ["responses_completed_valid", new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] }), { status: 200 })],
  ] as const;
  for (const [expected, response] of cases) {
    const adapter = createAzureDiceAdapter(config, async () => response.clone());
    const outcome = await adapter.invoke({ prompt: "closed fixture", prompt_version: "lumis_dice_v0_3_prompt_v2", language: "en", question_shape: "descriptive", deadline_at_ms: Date.now() + 1000, max_output_tokens: 300, signal: new AbortController().signal });
    check("provider_disposition" in outcome && outcome.provider_disposition === expected, `${expected} is classified exactly`);
    check(!/(must never|message|detail)/u.test(JSON.stringify(outcome)), `${expected} retains no provider detail`);
  }
}
main().catch((error) => { console.error(error); throw error; });
