import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const control = JSON.parse(read("supabase/tests/s2-t250-chat-synthetic-gateway-control.json"));
const schema = JSON.parse(read("supabase/tests/s2-t250-chat-synthetic-gateway-v1.schema.json"));
const engine = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
const adapter = read("supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts");
const route = read("supabase/functions/chat-synthetic/index.ts");
const normalChat = read("supabase/functions/chat-message/index.ts");
const doc = read("docs/architecture/S2-T250-chat-synthetic-gateway.md");

assert.deepEqual(control.statuses, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(control.normal_chat_connected, false);
assert.equal(control.default_enabled, false);
assert.deepEqual(control.request_fields, ["fixture_id", "idempotency_key", "run_id"]);
assert.deepEqual(control.canonical_response_fields, ["result", "assistant_message", "idempotency_outcome", "units_charged"]);
assert.deepEqual(control.caps, {
  logical_requests: 60, en_requests: 30, zh_hant_requests: 30, provider_attempts: 120,
  input_tokens: 1200, output_tokens: 300, concurrency: 1
});
assert.equal(control.provider.deadline_ms, 12000);
assert.equal(control.provider.maximum_attempts, 2);
assert.equal(control.provider.maximum_retries, 1);
assert.equal(control.telemetry.retention_days, 30);
assert.equal(control.deployment.executed, false);
assert.equal(control.deployment.model_calls_allowed, 0);

assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.units_charged.const, 0);
assert.equal(schema.properties.persistence.const, "not_committed");
assert.deepEqual(schema.properties.result.enum, ["completed", "duplicate", "fixed_fallback", "safety_rejected", "technical_error"]);

for (const source of [engine, route]) {
  assert.match(source, /LUMIS_AI_ENABLED|aiEnabled/);
  assert.match(source, /CHAT_SYNTHETIC_PROVIDER_DISABLED/);
}
assert.match(engine, /logicalRequests: 60/);
assert.match(engine, /enRequests: 30/);
assert.match(engine, /zhHantRequests: 30/);
assert.match(engine, /providerAttempts: 120/);
assert.match(engine, /inputTokens: 1200/);
assert.match(engine, /outputTokens: 300/);
assert.match(engine, /concurrency: 1/);
assert.match(engine, /deadlineMs: 12_000/);
assert.match(engine, /telemetryRetentionDays: 30/);
assert.match(engine, /DefaultV2/);
assert.match(route, /CHAT_SYNTHETIC_RUN_TOKEN/);
assert.match(route, /chat-synthetic/);
assert.doesNotMatch(route, /createClient|chat-message|persist|unit_ledger|account_id|device_id/);
assert.doesNotMatch(engine, /Deno\.env|fetch\s*\(|console\.|createClient|supabase/);
assert.match(adapter, /providerAlias/);
assert.doesNotMatch(adapter, /console\.|chat-message|account_id|device_id/);
assert.doesNotMatch(normalChat, /chat-synthetic|azure-chat-synthetic|AZURE_FOUNDRY_CHAT/);

for (const forbidden of ["message", "profile", "thread_id", "chart_context", "birth_data", "account_id", "device_id"]) {
  assert.equal(control.request_fields.includes(forbidden), false);
}
for (const status of control.statuses) assert.match(doc, new RegExp(status));
assert.match(doc, /zero model calls/i);
assert.match(doc, /separate from `chat-message`/i);

console.log("S2-T250 chat synthetic gateway source contract passed");
