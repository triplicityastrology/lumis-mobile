import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeNormalChatCase, loadNormalChatCases } from "./s2-normal-chat-offline-harness.mjs";
import { validateMobileResponse } from "./lib/s2-normal-chat-mobile-response-validator.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const schema = readJson("supabase/tests/s2-t193-normal-chat-contract-v1.schema.json");
const control = readJson("supabase/tests/s2-t193-normal-chat-control.json");
const matrix = readJson("supabase/tests/s2-t194-synthetic-azure-chat-matrix-v1.json");
const harness = loadNormalChatCases();
const hostile = readJson("supabase/tests/s2-t240-normal-chat-response-hostile-v1.json");
const readiness = readJson("supabase/tests/s2-t195-azure-readiness-control.json");
const statuses = ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"];

assert.deepEqual(control.status, statuses);
assert.deepEqual(matrix.status, statuses);
assert.deepEqual(readiness.status, statuses);
assert.deepEqual(control.canonical_mobile_response_fields, ["result", "assistant_message", "idempotency_outcome", "units_charged"]);
assert.equal(matrix.cases.length, 14);
assert.equal(harness.cases.length, 14);

const matrixById = new Map(matrix.cases.map((row) => [row.case_id, row]));
const harnessById = new Map(harness.cases.map((row) => [row.case_id, row]));
assert.deepEqual([...matrixById.keys()].sort(), [...harnessById.keys()].sort(), "matrix/harness case mapping drift");

let responseCount = 0;
for (const testCase of harness.cases) {
  const row = matrixById.get(testCase.case_id);
  assert(row, `missing matrix row ${testCase.case_id}`);
  assert.equal(row.scenario, testCase.scenario, `${testCase.case_id} scenario drift`);
  assert.deepEqual(row.expected_mobile_results, testCase.expected_mobile_results, `${testCase.case_id} expected result drift`);
  assert.equal(row.provider_calls, testCase.provider_calls, `${testCase.case_id} provider call drift`);

  const execution = executeNormalChatCase(testCase);
  assert.equal(execution.provider_calls, row.provider_calls, `${testCase.case_id} executed provider call drift`);
  assert.deepEqual(execution.responses.map(({ result }) => result), row.expected_mobile_results, `${testCase.case_id} response result drift`);
  assert.deepEqual(execution.responses.map(({ persistence }) => persistence), row.expected_persistence, `${testCase.case_id} persistence drift`);
  assert.deepEqual(execution.responses.map(({ units_charged }) => units_charged), row.units_charged, `${testCase.case_id} units drift`);
  for (const response of execution.responses) {
    validateMobileResponse(response, schema);
    assert(!("redaction" in response), `${testCase.case_id} leaked internal redaction metadata`);
    responseCount += 1;
  }
}

const executions = new Map(harness.cases.map((testCase) => [testCase.event, executeNormalChatCase(testCase)]));
const valid = structuredClone(executions.get("valid").responses[0]);
const bases = {
  completed: valid,
  duplicate: structuredClone(executions.get("concurrent_duplicate").responses[1]),
  fallback: structuredClone(executions.get("ambiguous_receipt").responses[0]),
  safety: structuredClone(executions.get("filter_block").responses[0]),
  technical: structuredClone(executions.get("unknown_field").responses[0])
};

for (const fixture of hostile.cases) {
  const candidate = { ...structuredClone(bases[fixture.base ?? "completed"]), ...(fixture.patch ?? {}) };
  for (const key of fixture.remove ?? []) delete candidate[key];
  assert.throws(() => validateMobileResponse(candidate, schema), undefined, fixture.id);
}

assert(!JSON.stringify(matrix).includes("completed_redacted"), "matrix contains invalid public result completed_redacted");
assert(!JSON.stringify(harness).includes("completed_redacted"), "harness contains invalid public result completed_redacted");
console.log(`S2-T240 cross-artifact contract validated 14/14 cases and ${responseCount} schema-valid mobile responses`);
