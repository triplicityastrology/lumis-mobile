import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runbook = readFileSync(
  "docs/setup/s2-t09-care-circle-staging-deployment-recovery-runbook.md",
  "utf8"
);
const readiness = readFileSync(
  "scripts/s2-care-circle-deployment-readiness.mjs",
  "utf8"
);
const auditSql = readFileSync(
  "supabase/tests/s2-t09-care-circle-legacy-audit.sql",
  "utf8"
);
const control = JSON.parse(
  readFileSync(
    "supabase/tests/s2-t09-care-circle-deployment-control.json",
    "utf8"
  )
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.execution_default, "local_validation_only");
assert.equal(control.recovery.pre_s2_t07_function_allowed, false);
assert.match(readiness, /STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb"/);
assert.match(readiness, /no network or database command ran/i);
assert.doesNotMatch(readiness, /\bfetch\s*\(|https?:\/\/|supabase db push|functions deploy/i);

const order = [
  "0032_care_circle_backend_foundation.sql",
  "0033_inactive_notification_foundation.sql",
  "0034_reusable_care_pairing_operations.sql",
  "care-circle Edge Function"
];
for (let index = 1; index < order.length; index += 1) {
  assert(
    runbook.indexOf(order[index - 1]) < runbook.indexOf(order[index]),
    `Runbook order is wrong at ${order[index]}.`
  );
}

for (const phrase of [
  "backup evidence",
  "legacy audit",
  "dry-run",
  "forward-only",
  "corrective migration",
  "minimum safe",
  "T08A",
  "no provider",
  "no scheduler",
  "no QR UI",
  "no check-ins",
  "no reminders",
  "no app activation"
]) {
  assert.match(
    runbook,
    new RegExp(phrase.replaceAll(" ", "\\s+"), "i")
  );
}

assert.match(
  runbook,
  /git merge-base --is-ancestor "\$MINIMUM_SAFE_FUNCTION_SHA" "\$SAFE_FUNCTION_SHA"/
);
assert.match(runbook, /a2aaee6bc7515310acc78719736d7122b814f1f5/);
assert.doesNotMatch(
  runbook,
  /migration repair[^]*reverted|db reset|drop\s+(?:table|function|schema)|git reset|git checkout|force-push/i
);
assert.match(
  runbook,
  /T08B[^]*must not run[^]*notification-device/i
);

assert.match(auditSql, /count\(\*\)/i);
assert.doesNotMatch(
  auditSql,
  /select\s+(?:\*|[^;\n]*(?:user_id|email|title|body|invitation_token_hash)\s*(?:,|from))/i
);

const localCommand = packageJson.scripts["test:s2-care-circle-deployment-readiness"];
const contractCommand =
  packageJson.scripts["test:s2-care-circle-deployment-runbook"];
for (const command of [localCommand, contractCommand]) {
  assert.doesNotMatch(
    command,
    /\bsupabase\b|\bpsql\b|\bcurl\b|\bfetch\b|\bpush\b|--execute/i
  );
}

console.log("S2-T09 staging deployment runbook contracts passed");
