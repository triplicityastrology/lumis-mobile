import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const harness = readFileSync(
  "scripts/s2-care-circle-staging-evidence.mjs",
  "utf8"
);
const wrapper = readFileSync(
  "scripts/run-s2-care-circle-staging-evidence.sh",
  "utf8"
);
const utility = readFileSync(
  "scripts/lib/staging-evidence-utils.mjs",
  "utf8"
);
const plan = JSON.parse(
  readFileSync("supabase/tests/s2-care-circle-staging-evidence-plan.json", "utf8")
);
const runbook = readFileSync(
  "docs/qa/s2-t08-care-circle-staging-evidence-runbook.md",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(plan.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(plan.execution_default, "preflight_only");
assert.equal(plan.actors.carers, 6);
assert.equal(plan.actors.existing_accounts_allowed, false);

assert.match(wrapper, /mode="\$\{1:-\}"/);
assert.match(wrapper, /\[\[ "\$mode" != "--execute" \]\]/);
assert.match(wrapper, /read -r -s secret_key/);
assert.match(wrapper, /read -r -s publishable_key/);
assert.doesNotMatch(wrapper, /echo .*(?:secret|publishable)|set -x|curl|supabase db push|functions deploy/i);
assert.match(harness, /parseEvidenceArgs/);
assert.match(harness, /if \(!args\.execute\)/);
assert.match(harness, /process\.exit\(0\)/);
assert.match(utility, /S2_EVIDENCE_EXECUTE/);
assert.match(utility, /args\.execute && process\.env\.S2_EVIDENCE_EXECUTE/);
assert.doesNotMatch(
  packageJson.scripts["test:s2-care-circle-staging-evidence"],
  /--execute|curl|supabase|deploy|push|fetch/i
);

for (const phrase of [
  "preflight",
  "execute",
  "cleanup",
  "forward-only",
  "redacted",
  "no migration",
  "no provider"
]) {
  assert.match(runbook, new RegExp(phrase, "i"));
}

for (const forbiddenOutput of [
  /console\.log\([^)]*(?:email|pairingCode|code_hash|token|body)/i,
  /printRedactedEvidence\([^)]*(?:email|pairingCode|token)/i
]) {
  assert.doesNotMatch(harness, forbiddenOutput);
}

console.log("Care Circle staging evidence harness contracts passed");
