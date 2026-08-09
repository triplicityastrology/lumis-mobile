import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const matrix = readJson("supabase/tests/s2-t194-synthetic-azure-chat-matrix-v1.json");
const harness = readJson("supabase/tests/s2-t206-normal-chat-offline-cases-v1.json");
const matrixText = JSON.stringify(matrix);

assert.deepEqual(matrix.status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(matrix.network_allowed, false);
assert.equal(matrix.real_member_text_allowed, false);
assert.equal(matrix.harness_version, harness.harness_version);
assert.equal(matrix.cases.length, 14);
assert.equal(harness.cases.length, 14);

const matrixIds = matrix.cases.map(({ case_id }) => case_id).sort();
const harnessIds = harness.cases.map(({ case_id }) => case_id).sort();
assert.deepEqual(matrixIds, harnessIds, "matrix-to-harness mapping must be bidirectional and complete");

for (const row of matrix.cases) {
  assert.match(row.case_id, /^CHAT-SYN-v1-\d{3}$/);
  const executable = harness.cases.find(({ case_id }) => case_id === row.case_id);
  assert(executable, `missing harness case ${row.case_id}`);
  assert.equal(row.scenario, executable.scenario, `${row.case_id} scenario drift`);
  assert.deepEqual(row.expected_mobile_results, executable.expected_mobile_results, `${row.case_id} result drift`);
  assert.equal(row.provider_calls, executable.provider_calls, `${row.case_id} call-count drift`);
  assert.equal(row.expected_persistence.length, row.expected_mobile_results.length, `${row.case_id} persistence cardinality drift`);
  assert.equal(row.units_charged.length, row.expected_mobile_results.length, `${row.case_id} unit cardinality drift`);
  for (const [index, result] of row.expected_mobile_results.entries()) {
    if (["technical_error", "fixed_fallback", "safety_rejected"].includes(result)) {
      assert.equal(row.expected_persistence[index], "not_committed", row.case_id);
      assert.equal(row.units_charged[index], 0, row.case_id);
    }
  }
}

for (const scenario of [
  "unknown_request_field", "aggregate_context_overflow", "content_filter_block",
  "content_filter_partial", "cross_actor_same_idempotency_key",
  "ambiguous_network_after_provider_receipt", "concurrent_duplicate",
  "one_bounded_retry", "provider_401_no_retry", "provider_403_no_retry",
  "atomic_success", "transaction_failure_zero_effect", "pii_and_log_redaction",
  "unsafe_bypass_rejected"
]) assert(matrix.cases.some((row) => row.scenario === scenario), `missing ${scenario}`);

for (const prohibited of [/https?:\/\//i, /bearer\s+/i, /api[_-]?key/i, /account[_-]?id/i, /birth[_-]?(date|time|place)/i]) {
  assert.doesNotMatch(matrixText, prohibited);
}
assert.doesNotMatch(matrixText, /completed_redacted|"units"\s*:|"deterministic_result"\s*:/);

console.log("S2-T206 synthetic matrix maps all 14/14 executable offline cases");
