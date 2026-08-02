import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { CARE_CIRCLE_READINESS_ACTIONS, resolveCareCircleFounderReadiness } from "./lib/care-circle-founder-readiness.mjs";

const base = {
  migration0037Parity: "not_recorded",
  customSecret: "not_recorded",
  functionDeployment: "not_recorded",
  functionHealth: "not_run",
  bootstrap: "source_ready",
  launcher: "source_ready",
  evidenceCleanup: "source_ready",
};
const cases = [
  [base, CARE_CIRCLE_READINESS_ACTIONS.migration0037AuthorizationNeeded],
  [{ ...base, migration0037Parity: "recorded" }, CARE_CIRCLE_READINESS_ACTIONS.customSecretNeeded],
  [{ ...base, migration0037Parity: "recorded", customSecret: "verified" }, CARE_CIRCLE_READINESS_ACTIONS.patDeploymentNeeded],
  [{ ...base, migration0037Parity: "recorded", customSecret: "verified", functionDeployment: "verified" }, CARE_CIRCLE_READINESS_ACTIONS.functionHealthNeeded],
  [{ ...base, migration0037Parity: "recorded", customSecret: "verified", functionDeployment: "verified", functionHealth: "passed" }, CARE_CIRCLE_READINESS_ACTIONS.qaKeyNeeded],
  [{ ...base, migration0037Parity: "recorded", customSecret: "verified", functionDeployment: "verified", functionHealth: "passed", bootstrap: "accounts_ready" }, CARE_CIRCLE_READINESS_ACTIONS.mobileLaunchNeeded],
  [{ ...base, migration0037Parity: "recorded", customSecret: "verified", functionDeployment: "verified", functionHealth: "passed", bootstrap: "accounts_ready", launcher: "mobile_ready" }, CARE_CIRCLE_READINESS_ACTIONS.mobileReady],
];
for (const [input, expected] of cases) assert.equal(resolveCareCircleFounderReadiness(input).nextAction, expected);
assert.throws(() => resolveCareCircleFounderReadiness({ ...base, endpoint: "private" }), /STOP_S2_T123_STATE_FIELDS_INVALID/);

const control = JSON.parse(readFileSync("supabase/tests/s2-t141-care-circle-live-readiness-control.json", "utf8"));
assert.deepEqual(control.required_remote_migration_versions, ["0032", "0033", "0034", "0037"]);
assert.deepEqual(control.required_custom_secret_names, ["CARE_CIRCLE_PAIRING_SECRET"]);
for (const entry of control.locked_sources) {
  assert.equal(createHash("sha256").update(readFileSync(entry.path)).digest("hex"), entry.sha256, entry.name);
}
assert.deepEqual(control.locked_sources.map(({ name }) => name), ["migration_0037", "edge_entry", "edge_boundary", "recovered_product_ui", "guided_workbench"]);

const cli = readFileSync("scripts/s2-care-circle-founder-readiness.mjs", "utf8");
for (const prohibited of [/fetch\s*\(/, /https?:\/\//, /process\.env/, /SUPABASE_(?:URL|KEY|ACCESS_TOKEN)/, /email|user_id|pairing_code/i]) assert.doesNotMatch(cli, prohibited);
const run = spawnSync(process.execPath, ["scripts/s2-care-circle-founder-readiness.mjs"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /migration_0037=not_recorded/);
assert.match(run.stdout, /local_rehearsal=available_non_live/);
assert.match(run.stdout, /next_safe_action=MIGRATION_0037_AUTHORIZATION_NEEDED/);
assert.match(run.stdout, /network_calls=0 credentials_requested=0 live_success_inferred=0/);
assert.doesNotMatch(run.stdout, /https?:\/\/|bmqhwofmdgebpcihjlnb|[0-9a-f]{32,}|@/i);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.scripts["care-circle:founder-readiness"], "node scripts/s2-care-circle-founder-readiness.mjs");
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-founder-readiness/);
console.log("S2-T141 Care Circle live-readiness contract passed; local rehearsal remains explicitly non-live.");
