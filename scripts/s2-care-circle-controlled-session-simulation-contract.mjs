import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CONTROLLED_SESSION_STAGES,
  resolveControlledSessionResume,
  runControlledSessionSimulation,
} from "./lib/care-circle-controlled-session-simulation.mjs";

const success = runControlledSessionSimulation();
assert.equal(success.status, "complete");
assert.deepEqual(success.completed, CONTROLLED_SESSION_STAGES);

for (const stage of CONTROLLED_SESSION_STAGES) {
  const failed = runControlledSessionSimulation({ failureAt: stage });
  assert.equal(failed.status, "failed", stage);
  assert.equal(failed.stoppedAt, stage, stage);
  assert.equal(failed.completed.includes(stage), false, stage);

  const interrupted = runControlledSessionSimulation({ interruptionAt: stage });
  assert.equal(interrupted.status, "interrupted", stage);
  assert.equal(interrupted.stoppedAt, stage, stage);
  assert.equal(interrupted.completed.includes(stage), false, stage);
}

assert.deepEqual(
  resolveControlledSessionResume(CONTROLLED_SESSION_STAGES.slice(0, 7)),
  {
    nextAction: "cleanup_disposable_session",
    recovery: ["cleanup_disposable_session", "revoke_qa_key"],
  }
);
assert.deepEqual(
  resolveControlledSessionResume(CONTROLLED_SESSION_STAGES.slice(0, 10)),
  { nextAction: "revoke_qa_key", recovery: ["revoke_qa_key"] }
);
assert.deepEqual(
  resolveControlledSessionResume(CONTROLLED_SESSION_STAGES.slice(0, 3)),
  { nextAction: "revoke_pat", recovery: ["revoke_pat"] }
);
assert.throws(
  () => resolveControlledSessionResume([CONTROLLED_SESSION_STAGES[1]]),
  /STOP_S2_T153_CHECKPOINT_ORDER_INVALID/
);

let adapterConstructed = false;
assert.throws(
  () => runControlledSessionSimulation({
    sealValidator: () => { throw new Error("STOP_S2_T146_SOURCE_DRIFT"); },
    adapterFactory: () => {
      adapterConstructed = true;
      return { run: () => "passed" };
    },
  }),
  /STOP_S2_T146_SOURCE_DRIFT/
);
assert.equal(adapterConstructed, false, "seal drift must stop before adapter construction");

const source = readFileSync("scripts/s2-care-circle-controlled-session-simulation.mjs", "utf8");
assert.doesNotMatch(source, /fetch\(|https?:\/\/|SUPABASE|token|secret|password|email|user_id/iu);
const run = spawnSync(process.execPath, ["scripts/s2-care-circle-controlled-session-simulation.mjs"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /network_calls=0 credentials_requested=0 remote_success_inferred=0/);

const matrix = JSON.parse(readFileSync("docs/qa/S2-T153-care-circle-controlled-session-scenario-matrix.json", "utf8"));
assert.equal(matrix.default_mode, "zero_network_simulation");
assert.deepEqual(matrix.checkpoints, CONTROLLED_SESSION_STAGES);
assert.deepEqual(matrix.scenarios, ["success", "failure_at_every_checkpoint", "interruption_at_every_checkpoint"]);
assert.equal(matrix.remote_evidence_claimed, false);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.scripts["test:s2-care-circle-controlled-session"], "node scripts/s2-care-circle-controlled-session-simulation-contract.mjs");
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-controlled-session/u);
console.log("S2-T153 controlled-session simulation contracts passed; all checkpoints remain zero-network.");
