import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CONTROL_PATH =
  "supabase/tests/s2-t09-free-plan-logical-backup-control.json";
const APPROVED_REF = "bmqhwofmdgebpcihjlnb";
const APPROVED_PARENT =
  "/Users/rubyku/Library/Application Support/LumisSecureBackups";
const args = parseArgs(process.argv.slice(2));

if (args.execute) {
  stop("LOGICAL_BACKUP_EXECUTION_FORBIDDEN");
}
if (args.projectRef !== APPROVED_REF) {
  stop("LOGICAL_BACKUP_STAGING_PROJECT_REQUIRED");
}

const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
assert.equal(control.project_ref, APPROVED_REF);
assert.equal(control.environment, "staging");
assert.equal(control.status, "founder_approved_pm_qa_pending");
assert.deepEqual(control.classification, {
  approved_by_founder_data_owner: true,
  approved_on: "2026-07-30",
  project_use: "staging_test_only",
  real_members_present: false,
  auth_relational_data_decision: "excluded",
  auth_exclusion_approved_by_founder_security_on: "2026-07-30",
  pm_acceptance: "pending",
  qa_acceptance: "pending",
});
assert.equal(control.execution_default, "local_validation_only");
assert.equal(control.execution_available, false);
assert.equal(control.supabase_cli_version, "2.109.1");
assert.equal(control.maximum_retention_days, 7);
assert.equal(control.backup_parent, APPROVED_PARENT);
assert.equal(control.mount_parent, "/Volumes");
assert.equal(control.backup_scope.storage_object_binaries, false);
assert.equal(control.backup_scope.edge_function_secrets, false);
assert.equal(control.backup_scope.provider_secrets, false);
assert.equal(control.backup_scope.auth_schema_definition, "excluded");
assert.equal(control.backup_scope.auth_relational_data, "excluded");
assert.equal(
  control.backup_scope.application_schema,
  "complete_application_owned_public_schema"
);
assert.deepEqual(control.backup_scope.relational_schema_allowlist, [
  "public",
  "supabase_migrations",
]);
assert(!control.backup_scope.relational_schema_allowlist.includes("auth"));

const linkedRefPath = path.resolve("supabase/.temp/project-ref");
if (existsSync(linkedRefPath)) {
  assert.equal(
    readFileSync(linkedRefPath, "utf8").trim(),
    APPROVED_REF,
    "Linked project is not approved staging."
  );
}

for (const fragment of control.forbidden_destination_fragments) {
  assert(
    !APPROVED_PARENT.includes(fragment),
    `Approved backup parent contains forbidden fragment ${fragment}.`
  );
}

for (const component of [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "manifest.sha256",
  "manifest.json",
]) {
  assert(control.required_components.includes(component));
}

for (const check of [
  "postgres_major_matches",
  "roles_restore",
  "schema_restore",
  "data_restore",
  "rls_enabled_state",
  "function_signatures",
  "migration_history",
  "table_count_relationships",
  "foreign_key_integrity",
  "application_owned_public_data_only",
  "auth_relational_data_excluded",
  "migration_0032_0033_0034_disposable_only",
]) {
  assert(control.required_restore_checks.includes(check));
}

process.stdout.write(
  [
    "logical_backup_readiness=passed",
    `project_ref=${APPROVED_REF}`,
    "execution_available=false",
    "network_calls=0",
    "database_reads=0",
    "filesystem_writes=0",
  ].join(" ") + "\n"
);

function parseArgs(values) {
  const projectIndex = values.indexOf("--project-ref");
  return {
    execute: values.includes("--execute"),
    projectRef: projectIndex >= 0 ? values[projectIndex + 1] : undefined,
  };
}

function stop(code) {
  process.stderr.write(`logical_backup_readiness=failed code=${code}\n`);
  process.exit(1);
}
