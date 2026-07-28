import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
const args = parseArgs(process.argv.slice(2));

assert.equal(
  args.projectRef,
  STAGING_PROJECT_REF,
  "Refusing preflight: project ref is not the approved Lumis staging project."
);

const linkedRefPath = path.resolve("supabase/.temp/project-ref");
if (existsSync(linkedRefPath)) {
  assert.equal(
    readFileSync(linkedRefPath, "utf8").trim(),
    STAGING_PROJECT_REF,
    "Refusing preflight: linked Supabase project is not staging."
  );
}

const migration32 = readFileSync(
  "supabase/migrations/0032_care_circle_backend_foundation.sql",
  "utf8"
);
const migration33 = readFileSync(
  "supabase/migrations/0033_inactive_notification_foundation.sql",
  "utf8"
);
const plan = JSON.parse(
  readFileSync(
    "supabase/tests/0032_0033_disposable_staging_plan.json",
    "utf8"
  )
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(plan.project_ref, STAGING_PROJECT_REF);
assert.equal(plan.environment, "staging");
assert.deepEqual(plan.migrations, [
  "0032_care_circle_backend_foundation.sql",
  "0033_inactive_notification_foundation.sql"
]);

for (const policy of [
  "disposable_users_only",
  "transactional_fixture_cleanup",
  "forbid_existing_user_ids",
  "forbid_provider_calls",
  "forbid_push_delivery",
  "forbid_scheduler_changes",
  "forbid_migration_apply"
]) {
  assert.equal(plan.execution_policy[policy], true, `missing safety policy ${policy}`);
}

for (const assumption of [
  "legacy-revoked-review",
  "legacy-code-fingerprint-only",
  "legacy-notification-row-audit",
  "migration-order"
]) {
  assert.ok(
    plan.legacy_preconditions.some((item) => item.id === assumption),
    `missing legacy precondition ${assumption}`
  );
}

for (const testCase of [
  "care-rls-owner-projection",
  "care-cross-user-denial",
  "caree-code-authority",
  "care-sixth-carer-race",
  "care-operation-idempotency",
  "care-pause-grace-removal",
  "care-account-deletion",
  "notification-registry-closed",
  "notification-registration-race",
  "notification-token-rotation",
  "notification-unregister-and-deletion",
  "notification-retention"
]) {
  const definition = plan.cases.find((item) => item.id === testCase);
  assert.ok(definition, `missing disposable test case ${testCase}`);
  assert.ok(definition.actors >= 1);
  assert.ok(definition.parallelism >= 1);
  assert.ok(definition.assertions.length >= 2);
}

assert.equal(
  plan.cases.find((item) => item.id === "care-sixth-carer-race").parallelism,
  6
);
assert.match(migration32, /CARE_LEGACY_REVOKED_ROWS_REQUIRE_REVIEW/);
assert.match(migration32, /if v_active_count >= 5/);
assert.match(migration32, /pg_advisory_xact_lock/);
assert.match(migration33, /check \(enabled = false\)/);
assert.match(migration33, /last_seen_at <= now\(\) - interval '90 days'/);
assert.match(migration33, /retention_until <= now\(\)/);

for (const source of [migration32, migration33]) {
  assert.doesNotMatch(
    source,
    /supabase db push|functions deploy|wrangler deploy|cron\.schedule|pg_net|net\.http/i
  );
}

const command = packageJson.scripts["test:s2-foundation-preflight"];
assert.match(command, /^node scripts\/s2-foundation-preflight\.mjs --project-ref /);
assert.doesNotMatch(command, /supabase|psql|curl|fetch|deploy|push/i);

const preflightSource = readFileSync(import.meta.filename, "utf8");
const imports = [...preflightSource.matchAll(/^import .+ from "([^"]+)";$/gm)]
  .map((match) => match[1])
  .sort();
assert.deepEqual(imports, [
  "node:assert/strict",
  "node:fs",
  "node:path"
]);

process.stdout.write(
  "S2 Care Circle/notification staging preflight passed locally; no network or database command ran.\n"
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
