import assert from "node:assert/strict";
import { resolveFounderBuildStatus } from "./founderBuildStatus";

const commit = "0123456789abcdef0123456789abcdef01234567";
const verified = resolveFounderBuildStatus(commit.toUpperCase());
assert.equal(verified.markerStatus, "verified");
assert.equal(verified.sourceCommit, commit);
assert.deepEqual(verified.features.map(({ id, included }) => ({ id, included })), [
  { id: "persona_comparison", included: true },
  { id: "quota_verification", included: true },
  { id: "care_circle_workbench", included: true },
  { id: "reflection_deletion_readiness", included: true },
  { id: "birth_details_fixes", included: true },
]);

for (const unsafe of [undefined, "", "main", "0123456", `${commit}x`, "https://example.test"]) {
  const result = resolveFounderBuildStatus(unsafe);
  assert.equal(result.markerStatus, "unavailable");
  assert.equal(result.sourceCommit, null);
}
console.log("Founder build status fixtures passed.");
