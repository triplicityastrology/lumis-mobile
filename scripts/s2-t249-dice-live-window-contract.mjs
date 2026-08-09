import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  KILL_CODES,
  LIMITS,
  STATUS,
  WindowStop,
  runControlledWindow,
  validateAuthorization,
  validateDisabledState,
  validateEvidence,
  validateEvidencePackage,
  validateGatewayDescriptor,
  validatePriceGate,
  validateRegistry,
} from "./lib/s2-t249-dice-live-window.mjs";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const runId = "dice-window-20260809alpha";
const descriptor = Object.freeze({
  interface_version: "dice_synthetic_gateway_port_v1",
  route: "dice-synthetic-v0-3",
  source_sha256: SHA_A,
  fixture_registry_sha256: SHA_B,
  response_schema: "dice_interpretation_response_v0_3",
  prompt_version: "dice_v0_3_synthetic_1",
});
const disabled = Object.freeze({
  interface_version: "dice_synthetic_gateway_status_v1",
  lumis_ai_enabled: false,
  provider_access: false,
  route_default_off: true,
});
const price = Object.freeze({
  schema: "s2_t249_live_price_confirmation_v1",
  currency: "USD",
  input_usd_per_million: 1,
  output_usd_per_million: 4,
  approved_window_cap_usd: 1,
  confirmed_by: "microsoft_azure_review",
  confirmed_at: "2026-08-09T00:00:00.000Z",
  valid_until: "2099-08-09T00:00:00.000Z",
});
const authorization = Object.freeze({
  schema: "s2_t249_dice_window_authorization_v1",
  dice_window_authorized: true,
  microsoft_review: "approved",
  technical_review: "approved",
  live_price_confirmed: true,
  gateway_source_sha256: SHA_A,
  fixture_registry_sha256: SHA_B,
  single_use_run_id: runId,
});

function buildRegistry() {
  const entries = [];
  for (const [phase, count] of [["technical", 40], ["founder", 20]]) {
    for (const language of ["en", "zh-Hant"]) {
      for (let index = 1; index <= count; index += 1) {
        entries.push({
          fixture_id: `${phase}_${language === "zh-Hant" ? "zh_hant" : "en"}_${String(index).padStart(3, "0")}`,
          phase,
          language,
        });
      }
    }
  }
  return entries;
}

function gateway(overrides = {}) {
  const events = [];
  let state = disabled;
  const port = {
    events,
    async describe() { events.push("describe"); return overrides.descriptor ?? descriptor; },
    async status() { events.push("status"); return overrides.status?.(events) ?? state; },
    async enableSyntheticWindow(input) { events.push(`enable:${input.run_id}`); state = { ...disabled, lumis_ai_enabled: true, provider_access: true, route_default_off: false }; },
    async invokeFixture(input) {
      events.push(`invoke:${input.fixture_id}`);
      return overrides.result?.(input, events) ?? {
        result_class: "completed",
        attempt_count: 1,
        input_tokens: 400,
        output_tokens: 180,
        duration_ms: 900,
        concurrency_peak: 2,
        redacted_failure_code: "none",
      };
    },
    async disable(input) { events.push(`disable:${input.run_id}`); if (overrides.disableError) throw new Error("redacted"); state = overrides.postState ?? disabled; },
  };
  if (overrides.missingMethod) delete port[overrides.missingMethod];
  return port;
}

async function expectStop(code, action) {
  await assert.rejects(action, (error) => error instanceof WindowStop && error.code === code);
}

assert.deepEqual(STATUS, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(LIMITS.logicalTotal, 120);
assert.equal(LIMITS.attempts, 240);
assert.equal(LIMITS.concurrency, 2);
assert.equal(LIMITS.deadlineMs, 12_000);
validateGatewayDescriptor(descriptor);
validateDisabledState(disabled, "pre");
assert.equal(validatePriceGate(price).calculated_max_cost_usd, 0.48);
assert.equal(validateAuthorization(authorization, descriptor), runId);
assert.equal(validateRegistry(buildRegistry()).length, 120);

const successPort = gateway();
const success = await runControlledWindow({ gateway: successPort, registry: buildRegistry(), price, authorization });
assert.equal(success.status, "WINDOW_COMPLETE_PROVIDER_DISABLED");
assert.equal(success.logical_total, 120);
assert.equal(success.attempt_total, 120);
assert.deepEqual(success.language, { en: 60, "zh-Hant": 60 });
assert.equal(success.provider_disabled_verified, true);
assert.equal(success.evidence.length, 120);
assert.equal(success.evidence[79].phase, "technical");
assert.equal(success.evidence[80].phase, "founder");
assert.equal(successPort.events.at(-2), `disable:${runId}`);
assert.equal(successPort.events.at(-1), "status");

const defaultOutput = JSON.parse(execFileSync(process.execPath, ["scripts/s2-t249-dice-live-window.mjs"], { encoding: "utf8" }));
assert.equal(defaultOutput.status, "READY_FOR_T247_INTEGRATION_AND_MICROSOFT_REVIEW");
assert.equal(defaultOutput.network_calls, 0);

const invalidRegistry = buildRegistry();
[invalidRegistry[0], invalidRegistry[80]] = [invalidRegistry[80], invalidRegistry[0]];
await expectStop(KILL_CODES.registry, () => runControlledWindow({ gateway: gateway(), registry: invalidRegistry, price, authorization }));

const preflightPort = gateway({ status: () => ({ ...disabled, lumis_ai_enabled: true }) });
await expectStop(KILL_CODES.configPre, () => runControlledWindow({ gateway: preflightPort, registry: buildRegistry(), price, authorization }));
assert.equal(preflightPort.events.includes(`enable:${runId}`), false);

await expectStop(KILL_CODES.price, () => runControlledWindow({ gateway: gateway(), registry: buildRegistry(), price: { ...price, valid_until: "2026-08-08T00:00:00.000Z" }, authorization }));
await expectStop(KILL_CODES.authority, () => runControlledWindow({ gateway: gateway(), registry: buildRegistry(), price, authorization: { ...authorization, dice_window_authorized: false } }));
await expectStop(KILL_CODES.gatewayDrift, () => runControlledWindow({ gateway: gateway({ missingMethod: "disable" }), registry: buildRegistry(), price, authorization }));

for (const [code, changed] of [
  [KILL_CODES.input, { input_tokens: 801 }],
  [KILL_CODES.output, { output_tokens: 301 }],
  [KILL_CODES.concurrency, { concurrency_peak: 3 }],
  [KILL_CODES.deadline, { duration_ms: 12_001 }],
  [KILL_CODES.retry, { attempt_count: 2, result_class: "fallback", redacted_failure_code: "provider_malformed" }],
  [KILL_CODES.defaultV2, { result_class: "completed", redacted_failure_code: "defaultv2_partial" }],
]) {
  const port = gateway({ result: () => ({ result_class: "completed", attempt_count: 1, input_tokens: 400, output_tokens: 180, duration_ms: 900, concurrency_peak: 2, redacted_failure_code: "none", ...changed }) });
  await expectStop(code, () => runControlledWindow({ gateway: port, registry: buildRegistry(), price, authorization }));
  assert.equal(port.events.some((event) => event.startsWith("disable:")), true, `${code} must disable immediately`);
}

const unsafePort = gateway({ result: () => ({ result_class: "completed", attempt_count: 1, input_tokens: 1, output_tokens: 1, duration_ms: 1, concurrency_peak: 1, redacted_failure_code: "none", raw_response: "forbidden" }) });
await expectStop(KILL_CODES.unsafe, () => runControlledWindow({ gateway: unsafePort, registry: buildRegistry(), price, authorization }));
assert.equal(unsafePort.events.some((event) => event.startsWith("disable:")), true);
assert.equal(unsafePort.events.some((event) => event.startsWith("invoke:founder_")), false);

const postflightPort = gateway({ postState: { ...disabled, provider_access: true } });
await expectStop(KILL_CODES.configPost, () => runControlledWindow({ gateway: postflightPort, registry: buildRegistry(), price, authorization }));
await expectStop(KILL_CODES.disable, () => runControlledWindow({ gateway: gateway({ disableError: true, status: () => disabled }), registry: buildRegistry(), price, authorization }));
await expectStop(KILL_CODES.configPost, () => runControlledWindow({ gateway: gateway({ disableError: true }), registry: buildRegistry(), price, authorization }));
const partialEnablePort = gateway();
partialEnablePort.enableSyntheticWindow = async () => { partialEnablePort.events.push("enable_failed"); throw new Error("redacted"); };
await assert.rejects(() => runControlledWindow({ gateway: partialEnablePort, registry: buildRegistry(), price, authorization }));
assert.equal(partialEnablePort.events.some((event) => event.startsWith("disable:")), true);

const validEvidence = success.evidence[0];
validateEvidence(validEvidence);
for (const hostile of [
  { ...validEvidence, prompt: "private" },
  { ...validEvidence, endpoint: "private" },
  { ...validEvidence, counters: { ...validEvidence.counters, secret: "private" } },
  { ...validEvidence, result_class: "unknown" },
  { ...validEvidence, run_id: "fabricated" },
]) {
  assert.throws(() => validateEvidence(hostile), (error) => error instanceof WindowStop);
}

const validPackage = {
  schema: "s2_t249_dice_window_evidence_package_v1",
  run_id: runId,
  gateway_source_sha256: SHA_A,
  fixture_registry_sha256: SHA_B,
  price_confirmation_sha256: "c".repeat(64),
  logical_total: 120,
  attempt_total: 120,
  language: { en: 60, "zh-Hant": 60 },
  technical_evidence_valid: true,
  founder_phase_ran: true,
  provider_disabled_verified: true,
  records: success.evidence,
};
validateEvidencePackage(validPackage, descriptor);
for (const hostile of [
  { ...validPackage, prompt: "fabricated" },
  { ...validPackage, gateway_source_sha256: "d".repeat(64) },
  { ...validPackage, provider_disabled_verified: false },
  { ...validPackage, records: success.evidence.slice(1) },
  { ...validPackage, attempt_total: 121 },
]) {
  assert.throws(() => validateEvidencePackage(hostile, descriptor), (error) => error instanceof WindowStop);
}

const evidenceSchema = JSON.parse(readFileSync("supabase/tests/s2-t249-dice-window-evidence.schema.json", "utf8"));
const gatewaySchema = JSON.parse(readFileSync("supabase/tests/s2-t249-dice-synthetic-gateway-interface.schema.json", "utf8"));
const gatewayResultSchema = JSON.parse(readFileSync("supabase/tests/s2-t249-dice-synthetic-gateway-result.schema.json", "utf8"));
const priceSchema = JSON.parse(readFileSync("supabase/tests/s2-t249-live-price-confirmation.schema.json", "utf8"));
const authorizationSchema = JSON.parse(readFileSync("supabase/tests/s2-t249-dice-window-authorization.schema.json", "utf8"));
const evidencePackageSchema = JSON.parse(readFileSync("supabase/tests/s2-t249-dice-window-evidence-package.schema.json", "utf8"));
const control = JSON.parse(readFileSync("config/s2-t249-dice-live-window-control.json", "utf8"));
assert.equal(evidenceSchema.additionalProperties, false);
assert.equal(gatewaySchema.additionalProperties, false);
assert.equal(gatewayResultSchema.additionalProperties, false);
assert.equal(priceSchema.additionalProperties, false);
assert.equal(authorizationSchema.additionalProperties, false);
assert.equal(evidencePackageSchema.additionalProperties, false);
assert.equal(control.execution_authority, false);
assert.equal(control.network_calls_in_default_mode, 0);
assert.deepEqual(control.status, STATUS);

const source = [
  readFileSync("scripts/lib/s2-t249-dice-live-window.mjs", "utf8"),
  readFileSync("scripts/s2-t249-dice-live-window.mjs", "utf8"),
  readFileSync("docs/qa/S2-T249-dice-live-window-runbook.md", "utf8"),
].join("\n");
for (const prohibited of ["fetch(", "https://", "AZURE_OPENAI_KEY", "SUPABASE_SERVICE_ROLE_KEY", "chat-message"]) {
  assert.equal(source.includes(prohibited), false, `remote or normal-chat capability forbidden: ${prohibited}`);
}

console.log("S2_T249_DICE_LIVE_WINDOW_CONTRACT_OK");
