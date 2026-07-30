import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  validateManifestRequest,
} from "./lib/logical-backup-manifest.mjs";

const checkerPath = "scripts/s2-care-circle-logical-backup-readiness.mjs";
const runbookPath =
  "docs/setup/s2-t09-free-plan-encrypted-logical-backup-readiness.md";
const controlPath =
  "supabase/tests/s2-t09-free-plan-logical-backup-control.json";
const checker = readFileSync(checkerPath, "utf8");
const runbook = readFileSync(runbookPath, "utf8");
const control = JSON.parse(readFileSync(controlPath, "utf8"));
const manifestWriter = readFileSync(
  "scripts/write-logical-backup-manifest.mjs",
  "utf8"
);
const manifestLibrary = readFileSync(
  "scripts/lib/logical-backup-manifest.mjs",
  "utf8"
);
const node = process.execPath;
const expectedRef = "bmqhwofmdgebpcihjlnb";

const ok = spawnSync(
  node,
  [checkerPath, "--project-ref", expectedRef],
  { encoding: "utf8", env: {} }
);
assert.equal(ok.status, 0);
assert.match(ok.stdout, /execution_available=false/);
assert.match(ok.stdout, /network_calls=0/);
assert.match(ok.stdout, /database_reads=0/);
assert.match(ok.stdout, /filesystem_writes=0/);

const wrongProject = spawnSync(
  node,
  [checkerPath, "--project-ref", "production-forbidden"],
  { encoding: "utf8", env: {} }
);
assert.notEqual(wrongProject.status, 0);
assert.match(wrongProject.stderr, /LOGICAL_BACKUP_STAGING_PROJECT_REQUIRED/);

const execute = spawnSync(
  node,
  [checkerPath, "--execute", "--project-ref", expectedRef],
  { encoding: "utf8", env: {} }
);
assert.notEqual(execute.status, 0);
assert.match(execute.stderr, /LOGICAL_BACKUP_EXECUTION_FORBIDDEN/);

assert.equal(control.execution_available, false);
assert.equal(control.maximum_retention_days, 7);
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
assert.equal(
  control.backup_parent,
  "/Users/rubyku/Library/Application Support/LumisSecureBackups"
);
assert.equal(control.backup_scope.storage_object_binaries, false);
assert.equal(control.backup_scope.edge_function_secrets, false);
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

assert.doesNotMatch(
  checker,
  /process\.env|fetch\(|https?:|execSync|execFile|spawn|hdiutil|pg_dump|db dump|curl|writeFile|mkdir|rmSync/i
);

const validManifestRequest = {
  backupUtcTimestamp: "2026-07-30T12:00:00Z",
  componentRoot: "/Volumes/LumisStagingBackup-20260730T120000Z",
  output:
    "/Volumes/LumisStagingBackup-20260730T120000Z/manifest.json",
  postgresMajor: "15",
  projectRef: expectedRef,
  sourceCommit: "a".repeat(40),
  supabaseCliVersion: "2.109.1",
};
assert.doesNotThrow(() => validateManifestRequest(validManifestRequest));
for (const componentRoot of [
  "/Users/rubyku/Documents/Mobile App/lumis-mobile/backup",
  "/Users/rubyku/Library/CloudStorage/GoogleDrive/backup",
  "/Users/rubyku/Library/Mobile Documents/backup",
  "/Users/rubyku/Desktop/backup",
  "/Users/rubyku/Downloads/backup",
  "/tmp/backup",
]) {
  assert.throws(
    () =>
      validateManifestRequest({
        ...validManifestRequest,
        componentRoot,
        output: `${componentRoot}/manifest.json`,
      }),
    /MANIFEST_ENCRYPTED_MOUNT_REQUIRED/
  );
}

const writerDefault = spawnSync(
  node,
  ["scripts/write-logical-backup-manifest.mjs"],
  { encoding: "utf8", env: {} }
);
assert.notEqual(writerDefault.status, 0);
assert.match(writerDefault.stderr, /MANIFEST_WRITE_NOT_AUTHORIZED/);
assert.doesNotMatch(
  `${manifestWriter}\n${manifestLibrary}`,
  /console\.log|process\.env|fetch\(|https?:|database_url|SUPABASE_DB_PASSWORD/i
);
assert.match(manifestLibrary, /flag: "wx"/);
assert.match(manifestLibrary, /mode: 0o600/);
assert.match(manifestLibrary, /createHash\("sha256"\)/);

for (const phrase of [
  "AES-256",
  "-stdinpass",
  "tmutil addexclusion",
  "tmutil isexcluded",
  "BACKUP_PARENT_REAL",
  "File System Personality:  APFS",
  "Encrypted:                 Yes",
  "roles.sql",
  "schema.sql",
  "data.sql",
  "manifest.sha256",
  "PostgreSQL major version",
  "RLS enabled state",
  "migration history",
  "table-count relationships",
  "no more than seven days",
  "forward-only\\s+corrective\\s+migration",
  "Storage object binaries",
  "Edge Function secrets",
]) {
  assert.match(
    runbook,
    phrase.includes("\\s+")
      ? new RegExp(phrase, "i")
      : new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
  );
}

assert.match(
  runbook,
  /Supabase Auth\s+relational data is unconditionally excluded/i
);
assert.match(runbook, /does not provide Auth identity or session recovery/i);
assert.match(runbook, /SUPABASE_DB_PASSWORD/);
assert.doesNotMatch(runbook, /--password\s+["'$]/);
assert.doesNotMatch(runbook, /echo\s+.*(?:PASSWORD|TOKEN|SECRET)/i);
assert.doesNotMatch(runbook, /set\s+-x/);
assert.doesNotMatch(runbook, /tee\s+.*(?:roles|schema|data)\.sql/i);

const codeBlocks = [...runbook.matchAll(/```zsh\n([\s\S]*?)```/g)]
  .map((match) => match[1])
  .join("\n");
const dumpSequence = extractSection(
  runbook,
  "## Future Hidden-Credential Dump Sequence",
  "## Metadata-Only Manifest"
);
assertDumpScopeExcludesAuth(dumpSequence);
for (const unsafeDump of [
  "supabase db dump --linked --data-only --schema public,auth",
  "supabase db dump --linked --data-only --schema auth",
  "supabase db dump --linked --data-only",
  "supabase db dump --linked --data-only --schema public,supabase_migrations --exclude 'storage.*'",
]) {
  assert.throws(
    () => assertDumpScopeExcludesAuth(unsafeDump),
    /AUTH_RELATIONAL_SCOPE_FORBIDDEN/
  );
}
for (const forbidden of [
  "/lumis-mobile/",
  "/GoogleDrive/",
  "/Google Drive/",
  "/CloudStorage/",
  "/iCloud/",
  "/Mobile Documents/",
  "/Desktop/",
  "/Downloads/",
]) {
  assert.doesNotMatch(
    codeBlocks
      .split("\n")
      .filter((line) => !line.includes("case \"$BACKUP_PARENT\""))
      .join("\n"),
    new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
}

assert.match(codeBlocks, /BACKUP_PARENT="\/Users\/rubyku\/Library\/Application Support\/LumisSecureBackups"/);
assert.match(codeBlocks, /MOUNT_POINT="\/Volumes\/\$VOLUME_NAME"/);
assert.match(codeBlocks, /--project-ref|EXPECTED_REF="bmqhwofmdgebpcihjlnb"/);
assert.match(runbook, /No command in this document has been executed/i);
assert.match(runbook, /impossible to execute\s+through the package command/i);

console.log("free-plan logical backup readiness contracts passed");

function assertDumpScopeExcludesAuth(value) {
  const dataCommand =
    value.match(/(?:^|\n)"?\$PNPM"?[\s\S]*?--data-only[\s\S]*?--file[^\n]*/)?.[0] ??
    value;
  const schemaMatch = dataCommand.match(/--schema\s+([^\s\\]+)/);
  const schemas = schemaMatch?.[1]?.replaceAll(/["']/g, "").split(",") ?? [];
  const hasExactAllowlist =
    schemas.length === 2 &&
    schemas[0] === "public" &&
    schemas[1] === "supabase_migrations";
  const excludesAuth = /--exclude\s+['"]auth\.\*['"]/.test(dataCommand);

  if (!hasExactAllowlist || schemas.includes("auth") || !excludesAuth) {
    throw new Error("AUTH_RELATIONAL_SCOPE_FORBIDDEN");
  }
}

function extractSection(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex);
  return source.slice(startIndex, endIndex);
}
