import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
const args = parseArgs(process.argv.slice(2));

assert.equal(
  args.projectRef,
  STAGING_PROJECT_REF,
  "Refusing readiness check: project ref is not approved Lumis staging."
);

const linkedRefPath = path.resolve("supabase/.temp/project-ref");
if (existsSync(linkedRefPath)) {
  assert.equal(
    readFileSync(linkedRefPath, "utf8").trim(),
    STAGING_PROJECT_REF,
    "Refusing readiness check: linked Supabase project is not staging."
  );
}

const control = JSON.parse(
  readFileSync(
    "supabase/tests/s2-t09-care-circle-deployment-control.json",
    "utf8"
  )
);
assert.equal(control.project_ref, STAGING_PROJECT_REF);
assert.equal(control.environment, "staging");
assert.equal(control.execution_default, "local_validation_only");

const expectedOrder = [
  "0032_care_circle_backend_foundation.sql",
  "0033_inactive_notification_foundation.sql",
  "0034_reusable_care_pairing_operations.sql",
  "care-circle Edge Function"
];
assert.deepEqual(
  control.deployment_order.map((entry) => entry.name),
  expectedOrder
);

for (const entry of control.deployment_order) {
  const filename = entry.name === "care-circle Edge Function"
    ? "supabase/functions/care-circle/index.ts"
    : `supabase/migrations/${entry.name}`;
  const actual = createHash("sha256")
    .update(readFileSync(filename))
    .digest("hex");
  assert.equal(actual, entry.sha256, `${entry.name} checksum changed.`);
}

for (const gate of [
  "exact_staging_ref",
  "migration_checksum_match",
  "legacy_revoked_count_zero",
  "legacy_code_fingerprint_review",
  "legacy_notification_privacy_count",
  "staging_backup_evidence",
  "dry_run_exact_order",
  "migration_parity",
  "function_version_capture",
  "unauthenticated_denial"
]) {
  assert(control.required_gates.includes(gate), `Missing gate ${gate}.`);
}

for (const boundary of [
  "notification_provider",
  "device_token_ui",
  "scheduler",
  "notification_delivery",
  "qr_ui",
  "check_in",
  "reminder",
  "care_circle_app_activation"
]) {
  assert(
    control.activation_forbidden.includes(boundary),
    `Missing inactive boundary ${boundary}.`
  );
}

assert.equal(
  control.recovery.database,
  "forward_only_corrective_migration"
);
assert.equal(control.recovery.pre_s2_t07_function_allowed, false);
assert.match(
  control.minimum_safe_function_commit,
  /^[0-9a-f]{40}$/
);

const runbook = readFileSync(
  "docs/setup/s2-t09-care-circle-staging-deployment-recovery-runbook.md",
  "utf8"
);
for (const migration of expectedOrder) {
  assert(runbook.includes(migration), `Runbook omits ${migration}.`);
}
assert(
  expectedOrder.every(
    (name, index) =>
      index === 0
      || runbook.indexOf(expectedOrder[index - 1]) < runbook.indexOf(name)
  ),
  "Runbook does not present the strict deployment order."
);

process.stdout.write(
  "S2-T09 deployment readiness passed locally; no network or database command ran.\n"
);

function parseArgs(values) {
  if (
    values.length !== 2
    || values[0] !== "--project-ref"
    || !values[1]
  ) {
    throw new Error("Use --project-ref with the approved staging project ref.");
  }
  return { projectRef: values[1] };
}
