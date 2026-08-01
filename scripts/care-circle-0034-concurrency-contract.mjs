import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-care-circle-0034-concurrency.sh", "utf8");
const schema = readFileSync("supabase/tests/s2-t68-care-circle-0034-minimal-schema.sql", "utf8");
const setup = readFileSync("supabase/tests/s2-t68-care-circle-0034-setup.sql", "utf8");
const verify = readFileSync("supabase/tests/s2-t68-care-circle-0034-verify.sql", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(runner, /0034_reusable_care_pairing_operations\.sql/);
assert.doesNotMatch(runner, /0032_|0033_|--linked|project-ref|supabase\.co/);
assert.match(runner, /for i in \{1\.\.6\}/);
assert.match(runner, /successes.*5/);
assert.match(runner, /capacity_rejections.*1/);
assert.match(runner, /STOP_S2_T68_REMOTE_CREDENTIAL_PRESENT/);
assert.match(schema, /resolve_care_circle_capability/);
assert.match(setup, /S2_T68_OUTSIDER_ACCEPTED/);
assert.match(setup, /S2_T68_CARER_DECLINED/);
assert.match(setup, /S2_T68_REPLAY_NOT_IDEMPOTENT/);
assert.match(setup, /S2_T68_CONFLICT_ACCEPTED/);
assert.match(verify, /S2_T68_ACTIVE_CAPACITY_MISMATCH/);
assert.match(verify, /S2_T68_ACCEPT_REPLAY_MISMATCH/);
assert.match(verify, /S2_T68_ACCEPT_CONFLICT_ALLOWED/);
assert.equal(
  packageJson.scripts["test:care-circle-0034-concurrency"],
  "bash scripts/run-care-circle-0034-concurrency.sh"
);
assert.match(packageJson.scripts["test:care-circle-regression-static"], /test:care-circle-0034-concurrency-contract/);
assert.equal(packageJson.scripts["pretest:all-local"], "pnpm test:care-circle-regression-static");

console.log("Care Circle 0034 independent concurrency contract passed");
