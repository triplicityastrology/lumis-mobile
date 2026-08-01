import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-care-circle-local-db-integration.sh", "utf8");
const proof = readFileSync("supabase/tests/s2-t64-care-circle-local-integration.sql", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(
  runner,
  /0032_care_circle_backend_foundation\.sql[\s\S]+0033_inactive_notification_foundation\.sql[\s\S]+0034_reusable_care_pairing_operations\.sql/
);
assert.doesNotMatch(runner, /--linked|project-ref|supabase\.co|curl|wget/);
assert.match(runner, /S2_T70_FULL_LOCAL_LIFECYCLE_PASSED/);
assert.match(runner, /S2_T70_LOCAL_CONTAINER_CLEANUP_CONFIRMED/);

for (const invariant of [
  "S2_T64_PENDING_AUTHORITY_VIOLATION",
  "S2_T64_CAREE_ONLY_ACCEPTANCE_FAILED",
  "S2_T64_SIXTH_CARER_ACCEPTED",
  "S2_T64_CROSS_USER_PROJECTION_LEAK",
  "S2_T70_CREATE_REPLAY_NOT_IDEMPOTENT",
  "S2_T70_CREATE_CONFLICT_ALLOWED",
  "S2_T70_ACCEPT_REPLAY_NOT_IDEMPOTENT",
  "S2_T70_DELETION_CLEANUP_FAILED"
]) {
  assert.match(proof, new RegExp(invariant));
}
assert.match(proof, /rollback;/);
assert.doesNotMatch(proof, /@|https?:\/\//i);
assert.equal(
  packageJson.scripts["test:care-circle-full-lifecycle-docker"],
  "bash scripts/run-care-circle-local-db-integration.sh"
);
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:care-circle-full-lifecycle-contract/);
assert.equal(packageJson.scripts["pretest:all-local"], "pnpm test:care-circle-aggregate-static");

console.log("Care Circle full local lifecycle contract passed");
