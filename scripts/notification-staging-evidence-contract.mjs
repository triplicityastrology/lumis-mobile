import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const harness = readFileSync(
  "scripts/s2-notification-staging-evidence.mjs",
  "utf8"
);
const wrapper = readFileSync(
  "scripts/run-s2-notification-staging-evidence.sh",
  "utf8"
);
const utility = readFileSync(
  "scripts/lib/staging-evidence-utils.mjs",
  "utf8"
);
const plan = JSON.parse(
  readFileSync(
    "supabase/tests/s2-notification-staging-evidence-plan.json",
    "utf8"
  )
);
const runbook = readFileSync(
  "docs/qa/s2-t08-notification-staging-evidence-runbook.md",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(plan.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(plan.execution_default, "preflight_only");
assert.equal(plan.actors.existing_accounts_allowed, false);
assert.equal(plan.actors.real_device_tokens_allowed, false);

assert.match(wrapper, /mode="\$\{1:-\}"/);
assert.match(wrapper, /\[\[ "\$mode" != "--execute" \]\]/);
assert.match(wrapper, /read -r -s secret_key/);
assert.match(wrapper, /read -r -s publishable_key/);
assert.doesNotMatch(
  wrapper,
  /echo .*(?:secret|publishable)|set -x|curl|supabase db push|functions deploy/i
);
assert.match(harness, /if \(!args\.execute\)/);
assert.match(harness, /runRedactedEvidenceMain/);
assert.match(harness, /safeCheck/);
assert.doesNotMatch(harness, /\bassert(?:\.|\()/);
assert.match(harness, /S2_DUMMY_TOKEN_/);
assert.match(utility, /S2_EVIDENCE_EXECUTE/);
assert.match(utility, /args\.execute && process\.env\.S2_EVIDENCE_EXECUTE/);
assert.doesNotMatch(
  packageJson.scripts["test:s2-notification-staging-evidence"],
  /--execute|curl|supabase|deploy|push|fetch/i
);

for (const phrase of [
  "preflight",
  "execute",
  "cleanup",
  "forward-only",
  "redacted",
  "no migration",
  "no provider",
  "dummy token"
]) {
  assert.match(runbook, new RegExp(phrase, "i"));
}

for (const forbiddenPrimitive of [
  /sendPushNotification/i,
  /scheduleNotification/i,
  /cron\.schedule/i,
  /fetch\([^)]*(?:expo\.dev|apple\.com|googleapis|fcm|apns)/i
]) {
  assert.doesNotMatch(harness, forbiddenPrimitive);
}

for (const forbiddenOutput of [
  /console\.log\([^)]*(?:email|dummyToken|provider_token|fingerprint|body)/i,
  /printRedactedEvidence\([^)]*(?:email|dummyToken|token|fingerprint)/i,
  /assert\.equal\([^,\n]*(?:token_fingerprint|endpoint_id|dummyToken)/i
]) {
  assert.doesNotMatch(harness, forbiddenOutput);
}

const forcedFailure = spawnSync(
  process.execPath,
  ["scripts/fixtures/redaction-safe-failure-fixture.mjs", "notification"],
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
assert.equal(failureEvidence.check, "notification_encryption");
assert.equal(
  failureEvidence.error_code,
  "NOTIFICATION_ENCRYPTION_MISMATCH"
);
for (const forbidden of [
  "S2_DUMMY_TOKEN_",
  "ciphertext-private-77aa",
  "fingerprint-private-44f9",
  "82acfd0a-7e5b-4ccb-a8fb-d61152adc475",
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

console.log("Notification staging evidence harness contracts passed");
