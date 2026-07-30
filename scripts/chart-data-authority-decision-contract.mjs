import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const gate = read(
  "packages/astrology/src/chart-data-authority-decision-gate.ts"
);
const fixtures = read(
  "packages/astrology/src/chart-data-authority-decision.fixtures.ts"
);
const doc = read(
  "docs/architecture/S2-T34-chart-data-integration-decision-fixture-pack.md"
);
const publicIndex = read("packages/astrology/src/index.ts");

const decisions = [
  "absolute_longitude_completeness",
  "house_cusp_authority",
  "canonical_angle_source",
  "moon_no_time_endpoint_source",
  "chart_source_version_provenance",
  "south_node_source",
  "derived_output_policy",
];
const failureCodes = [
  "CHART_AUTHORITY_ABSOLUTE_LONGITUDE_DECISION_REQUIRED",
  "CHART_AUTHORITY_HOUSE_CUSP_DECISION_REQUIRED",
  "CHART_AUTHORITY_ANGLE_SOURCE_DECISION_REQUIRED",
  "CHART_AUTHORITY_MOON_ENDPOINT_DECISION_REQUIRED",
  "CHART_AUTHORITY_PROVENANCE_DECISION_REQUIRED",
  "CHART_AUTHORITY_SOUTH_NODE_DECISION_REQUIRED",
  "CHART_AUTHORITY_DERIVED_OUTPUT_DECISION_REQUIRED",
];

for (const decision of decisions) {
  assert.match(gate, new RegExp(`"${decision}"`));
  assert.match(fixtures, new RegExp(`decision: "${decision}"`));
}
for (const code of failureCodes) {
  assert.match(gate, new RegExp(`"${code}"`));
  assert.match(doc, new RegExp(`\\\`${code}\\\``));
}

assert.match(doc, /without[\s\n]*selecting any policy/);
assert.match(doc, /There[\s\n]*is intentionally no success path/);
assert.match(doc, /synthetic non-personal natal values only/);
assert.match(fixtures, /syntheticTimedNatal/);
assert.match(fixtures, /syntheticNoTimeNatal/);
assert.match(fixtures, /cases\.length, 7/);
assert.match(fixtures, /serializedFailure\.includes\(fixtureId\)/);
assert.match(fixtures, /Object\.keys\(result\.error\)\.sort\(\)\.join/);
assert.doesNotMatch(publicIndex, /chart-data-authority-decision-gate/);

assert.doesNotMatch(
  `${gate}\n${fixtures}`,
  /fetch\(|supabase|openai|anthropic|astrology-api|process\.env|EXPO_PUBLIC|console\.(?:warn|error|debug)/
);
assert.doesNotMatch(
  doc,
  /supabase (?:db push|functions deploy)|wrangler deploy|curl |fetch\(|service_role\s*[:=]|sb_secret_/i
);

console.log("inactive chart-data authority decision contract passed");
