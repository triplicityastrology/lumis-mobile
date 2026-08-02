import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validatePostgres17CiEvidence } from "./lib/care-circle-postgres17-ci-evidence.mjs";

const valid = JSON.parse(readFileSync("supabase/tests/s2-t162-care-circle-postgres17-ci-evidence.valid.json", "utf8"));
const accepted = validatePostgres17CiEvidence(valid);
assert.equal(accepted.ok, true);
if (accepted.ok) assert.match(accepted.evidenceSha256, /^[0-9a-f]{64}$/u);

for (const mutate of [
  (value) => ({ ...value, logs: "proof output" }),
  (value) => ({ ...value, database_host: "private" }),
  (value) => ({ ...value, workflow_source_commit: "0".repeat(40) }),
  (value) => ({ ...value, workflow_sha256: "0".repeat(64) }),
  (value) => ({ ...value, postgres_version: "16" }),
  (value) => ({ ...value, migrations: value.migrations.slice(0, 3) }),
  (value) => ({ ...value, assertions: { ...value.assertions, cleanup_confirmed: false } }),
  (value) => ({ ...value, assertions: { ...value.assertions, rollback_passed: false } }),
  (value) => ({ ...value, remote_data_used: true }),
  (value) => ({ ...value, source_url: "https://example.invalid" }),
]) {
  const result = validatePostgres17CiEvidence(mutate(structuredClone(valid)));
  assert.equal(result.ok, false);
  assert.match(result.code, /^STOP_S2_T162_[A-Z0-9_]+$/u);
  assert.doesNotMatch(result.code, /private|example/iu);
}

const inert = spawnSync(process.execPath, ["scripts/s2-care-circle-postgres17-ci-evidence.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.match(inert.stdout, /WAITING_FOR_AUTHORISED_CI_EVIDENCE/);
assert.match(inert.stdout, /staging_ready=false remote_writes_authorized=false/);

const source = readFileSync("scripts/lib/care-circle-postgres17-ci-evidence.mjs", "utf8");
assert.match(source, /status:\s*"database_proof_recorded"/u);
assert.match(source, /staging_ready:\s*false/u);
assert.match(source, /remote_writes_authorized:\s*false/u);

console.log("S2-T162 PostgreSQL 17 CI evidence intake is WAITING_FOR_AUTHORISED_CI_EVIDENCE.");
