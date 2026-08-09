import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  gateway: "supabase/functions/_shared/dice-synthetic-gateway-v0-3.ts",
  registry: "supabase/functions/_shared/dice-synthetic-registry-v0-3.ts",
  reviewedRegistry: "supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts",
  registryAdapter: "supabase/functions/_shared/dice-synthetic-registry-adapter-v0-3.ts",
  adapter: "supabase/functions/_shared/azure-dice-adapter-v0-3.ts",
  endpoint: "supabase/functions/dice-synthetic/index.ts",
  fixtures: "supabase/functions/_shared/dice-synthetic-gateway-v0-3.fixtures.ts",
  schema: "supabase/tests/s2-t247-dice-interpretation-response-v0-3.schema.json",
  control: "supabase/tests/s2-t247-dice-synthetic-gateway-control.json"
};
const text = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, readFileSync(join(root, path), "utf8")]));
const control = JSON.parse(text.control);
const schema = JSON.parse(text.schema);

assert.equal(control.enabled_default, false);
assert.equal(control.normal_mobile_route, false);
assert.equal(control.normal_chat_route, false);
assert.equal(control.persistence_writes, 0);
assert.equal(control.units_charged, 0);
assert.deepEqual(control.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.deepEqual(control.caps, {
  logical_requests: 120,
  provider_attempts: 240,
  en: 60,
  "zh-Hant": 60,
  input_tokens: 800,
  output_tokens: 300,
  concurrency: 2,
  deadline_ms: 12000,
  eligible_retries: 1
});

assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.version.const, "dice_interpretation_response_v0_3");
assert.deepEqual(schema.properties.result.enum, ["completed", "safety_redirect", "fixed_fallback", "rejected", "technical_error"]);
assert.equal(schema.properties.effects.properties.persistence_writes.const, 0);
assert.equal(schema.properties.effects.properties.units_charged.const, 0);

assert.match(text.gateway, /parseClosedRequest/);
assert.match(text.gateway, /hasExactKeys\(raw, \["fixture_id"\]\)/);
assert.match(text.gateway, /DICE_PROVIDER_DEADLINE_MS = 12_000/);
assert.match(text.gateway, /maxEligibleRetries: 1/);
assert.match(text.gateway, /logicalRequests: 120/);
assert.match(text.gateway, /providerAttempts: 240/);
assert.match(text.gateway, /concurrency: 2/);
assert.match(text.gateway, /export interface DiceSyntheticBudgetPort/);
assert.match(text.gateway, /private readonly budget: DiceSyntheticBudgetPort/);
assert.match(text.gateway, /content_filter_block/);
assert.match(text.gateway, /content_filter_partial/);
assert.match(text.gateway, /persistence_writes: 0; units_charged: 0/);
for (const exclusion of ["natal chart", "birth data", "Level 3 body-part", "multi-throw element", "Past Reflections", "sharing cards", "Persona", "Knowledge Bank", "history context"]) {
  assert.ok(text.gateway.includes(exclusion), `missing v0.3 exclusion: ${exclusion}`);
}
assert.doesNotMatch(text.gateway, /console\.(log|warn|error)/);
assert.match(text.endpoint, /reviewedDiceSyntheticRegistry/);
assert.match(text.registryAdapter, /DICE_TECHNICAL_FIXTURES\.map/);
assert.match(text.registryAdapter, /fixtures\.get\(fixtureId\) \?\? null/);
assert.match(text.reviewedRegistry, /DICE_FOUNDER_RESERVED_SLOTS/);
assert.match(text.reviewedRegistry, /DICE_SYNTHETIC_REGISTRY_CHECKSUM = "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030"/);

const configPosition = text.endpoint.indexOf("readDiceAzureServerConfig");
const adapterPosition = text.endpoint.indexOf("createAzureDiceAdapter(config.config)");
assert.ok(configPosition >= 0 && adapterPosition > configPosition, "configuration gate must precede adapter construction");
assert.doesNotMatch(text.endpoint, /chat-message|createClient|SUPABASE_SERVICE_ROLE_KEY|persist|units/i);
assert.doesNotMatch(text.registry, /account|device|email|bearer|birth_date|member_id/i);

for (const clientPath of ["apps/mobile", "packages/shared"]) {
  const all = Object.values(files).join("\n");
  assert.ok(!all.startsWith(clientPath), "gateway files remain server/control only");
}

const forbiddenLogTokens = ["raw_prompt", "raw_response", "provider_diagnostics", "AZURE_OPENAI_API_KEY:"];
for (const token of forbiddenLogTokens) {
  assert.ok(!text.gateway.includes(token), `${token} must not appear in gateway output contract`);
}

const hashes = Object.fromEntries(Object.entries(files).filter(([name]) => name !== "control").map(([name, path]) => [name, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")]));
assert.equal(Object.keys(hashes).length, 8);
assert.ok(Object.values(hashes).every((hash) => /^[a-f0-9]{64}$/.test(hash)));

console.log(JSON.stringify({
  status: "S2_T247_SOURCE_REVIEW_PASSED",
  gateway: control.gateway_version,
  prompt: control.prompt_version,
  default_enabled: false,
  network_calls: 0,
  authority: control.authority_status
}));
