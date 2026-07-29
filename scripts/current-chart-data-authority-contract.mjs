import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const audit = readFileSync(
  "docs/architecture/S2-T23-current-chart-data-authority-matrix.md",
  "utf8"
);

assert.match(audit, /Status: inactive, source-grounded technical audit only/);
assert.match(
  audit,
  /provider_neutral_natal_v1[\s\S]*natal_engine_input_v1[\s\S]*natal_engine_output_v1[\s\S]*natal_context_v1/
);
for (const boundary of [
  "Chart request",
  "Provider normalization",
  "Onboarding persistence",
  "Regeneration persistence",
  "Chart history",
  "Active profile",
  "Mobile restoration",
  "Client sanitization",
  "Chat boundary",
]) {
  assert.match(audit, new RegExp(`\\| ${boundary} \\|`));
}
for (const field of [
  "Absolute planet longitude",
  "House cusp absolute longitude",
  "House number on cusp",
  "Ascendant",
  "Medium Coeli",
  "Moon local-day start/end longitudes",
  "Canonical aliases",
  "Calculation timestamp",
  "Chart source",
  "Chart version",
  "Worker request/calculation ID",
]) {
  assert.match(audit, new RegExp(`\\| ${field} \\|`));
}
assert.match(audit, /Founder-Decision Appendix/);
assert.match(audit, /No decision is made by this audit/);
assert.match(audit, /Failure at steps 2-9 must leave the existing chart\/profile\/history unchanged/);
assert.match(audit, /Dice[\s\S]*No import, field, invocation, persistence, or integration/);
assert.doesNotMatch(
  audit,
  /curl |supabase (?:db|functions)|wrangler|fetch\(|process\.env|sb_secret_|service_role\s*[:=]/i
);

console.log("inactive current chart-data authority audit passed");
