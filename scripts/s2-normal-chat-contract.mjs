import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const schema = JSON.parse(read("supabase/tests/s2-t193-normal-chat-contract-v1.schema.json"));
const control = JSON.parse(read("supabase/tests/s2-t193-normal-chat-control.json"));
const doc = read("docs/architecture/S2-T193-proposed-server-normal-chat-contract.md");
const response = schema.$defs.mobileResponse;
const responseText = JSON.stringify(response);

assert.equal(schema.additionalProperties, false);
assert.equal(schema.$defs.mobileRequest.additionalProperties, false);
assert.equal(response.additionalProperties, false);
assert.equal(response.oneOf.length, 5);
assert.deepEqual(control.canonical_mobile_response_fields, ["result", "assistant_message", "idempotency_outcome", "units_charged"]);
assert(response.required.includes("idempotency_outcome"));
assert(response.required.includes("units_charged"));
assert("assistant_message" in response.properties);
assert(!("assistant_text" in response.properties));
assert.match(schema.$defs.uuidV4.pattern, /-4/);
assert.match(schema.$defs.uuidV4.pattern, /\[89ab\]/);
assert.deepEqual(control.status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(control.integration_enabled, false);
assert.equal(control.azure_traffic_authorized, false);
assert.equal(control.canonicalization.unicode, "NFC");
assert.equal(control.canonicalization.line_endings, "LF");
assert.equal(control.provider.total_timeout_ms, 12000);
assert.equal(control.provider.maximum_retries, 1);
assert.equal(control.aggregate_context.final_limits_status, "UNRESOLVED_FOUNDER_DECISION");
assert.deepEqual(control.zero_effect_results, ["fixed_fallback", "safety_rejected", "technical_error"]);

for (const exact of [control.approved_copy.fixed_fallback, control.approved_copy.safety_redirect]) {
  assert(responseText.includes(exact), `schema does not lock exact copy: ${exact}`);
  assert(doc.includes(exact), `documentation does not lock exact copy: ${exact}`);
}
for (const token of ["server-owned UUIDv4", "NFC", "LF line endings", "zero units", "persist nothing", "atomic transaction"]) {
  assert(doc.includes(token), `contract documentation missing ${token}`);
}
for (const prohibited of ["account_id", "bearer_token", "device_id", "birth_date", "azure_endpoint", "model_id"]) {
  assert(control.mobile_prohibited_fields.includes(prohibited));
}

console.log("S2-T205 corrected mutually-exclusive normal-chat contract checks passed");
