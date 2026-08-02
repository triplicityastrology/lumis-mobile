import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CARE_CIRCLE_FOUNDER_SESSION_STAGES, resolveFounderSessionCheckpoint } from "./lib/care-circle-founder-session.mjs";

assert.equal(CARE_CIRCLE_FOUNDER_SESSION_STAGES.length, 14);
assert.equal(resolveFounderSessionCheckpoint([]).next, "deployment_verified");
assert.equal(resolveFounderSessionCheckpoint(CARE_CIRCLE_FOUNDER_SESSION_STAGES.slice(0, 3)).next, "two_accounts_ready");
const afterAccounts = resolveFounderSessionCheckpoint(CARE_CIRCLE_FOUNDER_SESSION_STAGES.slice(0, 4));
assert.equal(afterAccounts.cleanupRequired, true);
assert.equal(afterAccounts.qaKeyRevocationRequired, true);
const afterCleanup = resolveFounderSessionCheckpoint(CARE_CIRCLE_FOUNDER_SESSION_STAGES.slice(0, 13));
assert.equal(afterCleanup.cleanupRequired, false);
assert.equal(afterCleanup.qaKeyRevocationRequired, true);
assert.deepEqual(resolveFounderSessionCheckpoint([...CARE_CIRCLE_FOUNDER_SESSION_STAGES]), {
  status: "complete", completedCount: 14, next: null, nextOperator: null,
  cleanupRequired: false, qaKeyRevocationRequired: false,
});
for (const invalid of [
  ["function_health_passed"],
  ["deployment_verified", "function_health_passed"],
  [...CARE_CIRCLE_FOUNDER_SESSION_STAGES, "extra"],
]) assert.throws(() => resolveFounderSessionCheckpoint(invalid), /STOP_S2_T109_/);

const source = readFileSync("scripts/s2-care-circle-founder-session.mjs", "utf8");
assert.doesNotMatch(source, /writeFile|appendFile|localStorage|AsyncStorage|@supabase|fetch\(|https?:\/\//);
assert.doesNotMatch(source, /token|password|email|user_id|pairing_code/i);
const preflight = spawnSync(process.execPath, ["scripts/s2-care-circle-founder-session.mjs"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /next=deployment_verified/);
assert.match(preflight.stdout, /state_persisted=false network_calls=0 credentials_requested=0/);

console.log("S2-T109 Care Circle Founder session coordinator contracts passed; no state or credential was retained.");
