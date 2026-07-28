import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
assert.match(harness, /runRedactedEvidenceMain/);
assert.match(harness, /safeCheck/);
assert.doesNotMatch(harness, /\bassert(?:\.|\()/);
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
  /printRedactedEvidence\([^)]*(?:email|pairingCode|token)/i,
  /assert\.equal\([^,\n]*(?:pairing_code|pairingCode|code_hash)/i
]) {
  assert.doesNotMatch(harness, forbiddenOutput);
}

const forcedFailure = spawnSync(
  process.execPath,
  ["scripts/fixtures/redaction-safe-failure-fixture.mjs", "care"],
  { encoding: "utf8" }
);
assert.equal(forcedFailure.status, 1);
assert.equal(forcedFailure.stdout, "");
const failureEvidence = JSON.parse(forcedFailure.stderr.trim());
assert.deepEqual(Object.keys(failureEvidence).sort(), [
  "check",
  "error_code",
  "run_id"
]);
assert.equal(failureEvidence.check, "pairing_code_replay");
assert.equal(
  failureEvidence.error_code,
  "CARE_PAIRING_CODE_MISMATCH"
);
for (const forbidden of [
  "PAIR-RAW-7X9Q",
  "fingerprint-private-44f9",
  "82acfd0a-7e5b-4ccb-a8fb-d61152adc475",
  "fixture-private@example.invalid",
  "token-private-7dce",
  "database-payload",
  "actual",
  "expected",
  "AssertionError",
  "at file:"
]) {
  assert.doesNotMatch(
    `${forcedFailure.stdout}\n${forcedFailure.stderr}`,
    new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
  );
}

console.log("Care Circle staging evidence harness contracts passed");
