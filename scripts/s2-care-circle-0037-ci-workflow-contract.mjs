import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const workflow = readFileSync(".github/workflows/s2-t157-care-circle-postgres17-proof.yml", "utf8");
assert.match(workflow, /workflow_dispatch:/u);
assert.doesNotMatch(workflow, /push:|pull_request:|schedule:/u);
assert.match(workflow, /ubuntu-24\.04/);
assert.match(workflow, /public\.ecr\.aws\/supabase\/postgres:17\.6\.1\.143/);
assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u);
assert.match(workflow, /S2_T148_ENGINE: docker/);
assert.match(workflow, /run-care-circle-0037-four-digit\.sh/);
assert.doesNotMatch(workflow, /secrets\.|supabase\.co|--linked|project-ref|DATABASE_URL:/u);

const harness = readFileSync("scripts/run-care-circle-0037-docker.sh", "utf8");
assert.match(harness, /--network none/);
for (const version of ["0032", "0033", "0034", "0037"]) assert.match(harness, new RegExp(`${version}_`));
for (const proof of ["S2_T139_FOUR_DIGIT_TRANSACTION_PASSED", "S2_T139_CONCURRENT_THROTTLE_PASSED", "cleanup=confirmed"]) assert.match(harness, new RegExp(proof));

const ready = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-ci-readiness.mjs", "--verify"], { encoding: "utf8" });
assert.equal(ready.status, 0, ready.stderr);
assert.match(ready.stdout, /READY_FOR_CI_EXECUTION/);
assert.match(ready.stdout, /ci_proof_claimed=false/);
const rejected = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-ci-readiness.mjs", "--verify"], {
  encoding: "utf8",
  env: { ...process.env, PGHOST: "remote.invalid" },
});
assert.notEqual(rejected.status, 0);
assert.equal(rejected.stderr, "STOP_S2_T157_REMOTE_DATABASE_CONTEXT_PRESENT\n");
assert.doesNotMatch(rejected.stdout + rejected.stderr, /remote\.invalid/u);

const evidence = JSON.parse(readFileSync("docs/qa/S2-T157-care-circle-postgres17-ci-evidence-schema.json", "utf8"));
assert.equal(evidence.status, "READY_FOR_CI_EXECUTION");
assert.equal(evidence.current_ci_evidence, null);
console.log("S2-T157 PostgreSQL 17 CI workflow is READY_FOR_CI_EXECUTION; no CI proof claimed.");
