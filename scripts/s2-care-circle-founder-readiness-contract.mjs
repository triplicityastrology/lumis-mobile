import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CARE_CIRCLE_READINESS_ACTIONS,
  resolveCareCircleFounderReadiness,
} from "./lib/care-circle-founder-readiness.mjs";

const base = {
  migrationsParity: "recorded",
  functionDeployment: "not_recorded",
  functionHealth: "not_run",
  bootstrap: "source_ready",
  launcher: "source_ready",
  evidenceCleanup: "source_ready",
};

assert.equal(resolveCareCircleFounderReadiness(base).nextAction, CARE_CIRCLE_READINESS_ACTIONS.patNeeded);
assert.equal(
  resolveCareCircleFounderReadiness({ ...base, functionDeployment: "verified" }).nextAction,
  CARE_CIRCLE_READINESS_ACTIONS.functionHealthNeeded
);
assert.equal(
  resolveCareCircleFounderReadiness({ ...base, functionDeployment: "verified", functionHealth: "passed" }).nextAction,
  CARE_CIRCLE_READINESS_ACTIONS.qaKeyNeeded
);
assert.equal(
  resolveCareCircleFounderReadiness({
    ...base,
    functionDeployment: "verified",
    functionHealth: "passed",
    bootstrap: "accounts_ready",
  }).nextAction,
  CARE_CIRCLE_READINESS_ACTIONS.mobileLaunchNeeded
);
assert.equal(
  resolveCareCircleFounderReadiness({
    ...base,
    functionDeployment: "verified",
    functionHealth: "passed",
    bootstrap: "accounts_ready",
    launcher: "mobile_ready",
  }).nextAction,
  CARE_CIRCLE_READINESS_ACTIONS.mobileReady
);
assert.throws(
  () => resolveCareCircleFounderReadiness({ ...base, endpoint: "private" }),
  /STOP_S2_T123_STATE_FIELDS_INVALID/
);

const cli = readFileSync("scripts/s2-care-circle-founder-readiness.mjs", "utf8");
for (const prohibited of [
  /fetch\s*\(/,
  /https?:\/\//,
  /process\.env/,
  /SUPABASE_(?:URL|KEY|ACCESS_TOKEN)/,
  /email|user_id|pairing_code|secret/i,
]) {
  assert.doesNotMatch(cli, prohibited);
}

const run = spawnSync("node", ["scripts/s2-care-circle-founder-readiness.mjs"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /^S2_T123_CARE_CIRCLE_FOUNDER_READINESS/m);
assert.match(run.stdout, /migrations_parity=recorded/);
assert.match(run.stdout, /function_deployment=not_recorded/);
assert.match(run.stdout, /next_safe_action=PAT_NEEDED/);
assert.match(run.stdout, /network_calls=0 credentials_requested=0 live_success_inferred=0/);
assert.doesNotMatch(run.stdout, /https?:\/\/|bmqhwofmdgebpcihjlnb|[0-9a-f]{32,}|@/i);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.scripts["care-circle:founder-readiness"], "node scripts/s2-care-circle-founder-readiness.mjs");
assert.equal(
  packageJson.scripts["test:s2-care-circle-founder-readiness"],
  "node scripts/s2-care-circle-founder-readiness-contract.mjs"
);
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-founder-readiness/);
assert.equal(packageJson.scripts["pretest:all-local"], "pnpm test:care-circle-aggregate-static");

console.log("S2-T123 Care Circle Founder readiness diagnostic passed; no live state was inferred.");
