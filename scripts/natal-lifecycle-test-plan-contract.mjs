import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plan = readFileSync(
  "docs/qa/S2-T19-natal-lifecycle-integration-test-plan.md",
  "utf8"
);

assert.match(plan, /Status: inactive, non-networked, source-level test plan/);
assert.match(
  plan,
  /provider_neutral_natal_v1[\s\S]*natal_engine_input_v1[\s\S]*natal_engine_output_v1[\s\S]*natal_context_v1/
);
for (const fixtureId of [
  "NL-001",
  "NL-002",
  "NL-003",
  "NL-004",
  "NL-005",
  "NL-006",
  "NL-007",
  "NL-008",
  "NL-009",
  "NL-010",
  "NL-011",
  "NL-012",
]) {
  assert.match(plan, new RegExp(`\\\`${fixtureId}\\\``));
}
for (const required of [
  "Complete timed natal chart",
  "No-birth-time natal chart",
  "Chiron and Nodes",
  "Malformed provider payload",
  "Duplicate aliases",
  "Scope contamination",
  "Exact-orb aspects",
  "Deterministic ordering",
  "PII exclusion",
  "Dice exclusion",
  "Persistence gate",
  "Account-restoration gate",
  "Edge and Chat integration gate",
  "Knowledge Bank retrieval gate",
  "User-facing interpretation gate",
]) {
  assert.match(plan, new RegExp(required));
}
assert.match(plan, /Dice is fully excluded from this lifecycle/);
assert.match(plan, /It performs static local checks only/);
assert.match(plan, /does not execute the future lifecycle/);
assert.match(plan, /no customer data or secret was used/);
assert.doesNotMatch(plan, /https?:\/\//);
assert.doesNotMatch(plan, /sb_secret_|service_role\s*[:=]|password\s*[:=]/i);

console.log("inactive natal lifecycle integration test plan contract passed");
