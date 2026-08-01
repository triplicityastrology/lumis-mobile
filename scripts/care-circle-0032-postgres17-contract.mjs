import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-care-circle-0032-postgres17.sh", "utf8");
const migration = readFileSync("supabase/migrations/0032_care_circle_backend_foundation.sql", "utf8");
const fixture = readFileSync("supabase/tests/s2-t67-care-circle-retention.sql", "utf8");
const compatibility = readFileSync("supabase/tests/s2-t64-local-supabase-compatibility.sql", "utf8");

assert.match(runner, /0032_care_circle_backend_foundation\.sql/);
assert.doesNotMatch(runner, /0033_|0034_|--linked|project-ref|supabase\.co/);
assert.match(runner, /STOP_S2_T67_REMOTE_CREDENTIAL_PRESENT/);
assert.match(migration, /retention_until timestamptz not null/);
assert.match(migration, /before insert or update of expires_at/);
assert.match(fixture, /S2_T67_INSERT_RETENTION_MISMATCH/);
assert.match(fixture, /S2_T67_UPDATE_RETENTION_MISMATCH/);
assert.match(fixture, /rollback;/);
assert.match(compatibility, /graphql_watch_ddl/);
assert.match(compatibility, /pgrst_ddl_watch/);
assert.doesNotMatch(compatibility, /disable row level security/);

console.log("Care Circle 0032 PostgreSQL 17 retention contract passed");
