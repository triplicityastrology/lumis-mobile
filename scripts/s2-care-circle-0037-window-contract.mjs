import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { appendCheckpoint, validateCheckpoint } from "./lib/care-circle-0037-window.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t143-care-circle-0037-window-control.json", "utf8"));
assert.deepEqual(control.stages, ["rehearsal_accepted", "migration_0037_recorded", "pairing_secret_verified_and_pat_revoked", "function_deployed_and_pat_revoked", "health_passed", "receipt_sealed"]);
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
let checkpoint = null;
for (const stage of control.stages) checkpoint = appendCheckpoint(checkpoint, stage, "a".repeat(64), control);
assert.equal(validateCheckpoint(checkpoint, control).completed.length, 6);
assert.throws(() => appendCheckpoint(null, "migration_0037_recorded", "a".repeat(64), control), /STOP_S2_T143_STAGE_SEQUENCE_INVALID/);
assert.throws(() => validateCheckpoint({ ...checkpoint, digest: "b".repeat(64) }, control), /STOP_S2_T143_CHECKPOINT_DIGEST_INVALID/);

const source = readFileSync("scripts/s2-care-circle-0037-window.mjs", "utf8");
assert.doesNotMatch(source, /fetch\s*\(|https?:\/\/|SUPABASE_ACCESS_TOKEN|SERVICE_ROLE|pairing_code|response_body|endpoint/i);
assert.match(source, /--accepted/);
assert.match(source, /REHEARSAL_ENVELOPE_REQUIRED/);
assert.match(source, /flag: "wx"/);
const run = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-window.mjs"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /next=rehearsal_accepted/);
assert.match(run.stdout, /network_calls=0 credentials_requested=0 filesystem_writes=0/);
assert.doesNotMatch(run.stdout + run.stderr, /bmqhwofmdgebpcihjlnb|[0-9a-f]{40,}|https?:\/\//);
console.log("S2-T143 checkpointed 0037 staging-window operator contract passed; default remained inert.");
