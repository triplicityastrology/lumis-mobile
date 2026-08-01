import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/0036_owner_safe_reflection_deletion.sql";
const runner = readFileSync("scripts/run-reflection-deletion-local-db.sh", "utf8");
const proof = readFileSync("supabase/tests/s2-t87-reflection-deletion-local.sql", "utf8");
const control = JSON.parse(readFileSync("config/s2-t84-reflection-deletion-readiness.json", "utf8"));
const migration = readFileSync(migrationPath);
const checksum = createHash("sha256").update(migration).digest("hex");

assert.equal(control.migration.version, "0036");
assert.equal(control.migration.path, migrationPath);
assert.equal(control.migration.sha256, checksum);
assert.equal(control.prewrite_history_shape_status, "confirmed_t82_text_shape");
assert.equal(control.local_postgres17_proof, "required_and_passing");
assert.equal(control.execution_available, false);

for (const invariant of [
  "S2_T87_OWNER_DELETE_FAILED",
  "S2_T87_MESSAGE_CASCADE_FAILED",
  "S2_T87_UNRELATED_THREAD_CHANGED",
  "S2_T87_REPLAY_NOT_IDEMPOTENT",
  "S2_T87_REQUEST_CONFLICT_ALLOWED",
  "S2_T87_CROSS_OWNER_DELETE_ALLOWED",
  "S2_T87_UNAUTHENTICATED_DELETE_ALLOWED",
  "S2_T87_ANONYMOUS_EXECUTE_ALLOWED"
]) assert.match(proof, new RegExp(invariant));

assert.match(proof, /rollback;/);
assert.doesNotMatch(proof, /@|https?:\/\//i);
assert.match(runner, /public\.ecr\.aws\/supabase\/postgres:17\.6\.1\.143/);
assert.match(runner, /0036_owner_safe_reflection_deletion\.sql/);
assert.match(runner, /S2_T87_LOCAL_CONTAINER_CLEANUP_CONFIRMED/);
assert.doesNotMatch(runner, /--linked|project-ref|supabase\.co|curl|wget/);

process.stdout.write("S2-T87 reflection deletion database contracts passed; Docker proof remains separately invoked.\n");
