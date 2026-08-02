import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { discoverProfileTestUsers, expectedProfileTestEmail, validateProfileTestPair, validateProfileTestSetup } from "./lib/profile-test-account-operator.mjs";

const runId = "s2t110-20260801t120000z-abcdef12";
const valid = { runId, projectRef: "bmqhwofmdgebpcihjlnb", timedEmail: expectedProfileTestEmail(runId, "timed"), noTimeEmail: expectedProfileTestEmail(runId, "no_time"), timedPassword: "timed-password-123456!", noTimePassword: "no-time-password-1234!" };
assert.doesNotThrow(() => validateProfileTestSetup(valid));
assert.throws(() => validateProfileTestSetup({ ...valid, timedEmail: "member@example.com" }), /STOP_S2_T110_/);
const users = Array.from({ length: 1_205 }, (_, index) => ({ id: `u-${index}`, user_metadata: {} }));
users[1100] = { id: "timed", user_metadata: { s2_evidence_suite: "s2t110", s2_evidence_run_id: runId, s2_evidence_role: "timed" } };
users[1204] = { id: "no-time", user_metadata: { s2_evidence_suite: "s2t110", s2_evidence_run_id: runId, s2_evidence_role: "no_time" } };
const found = await discoverProfileTestUsers(async (page, size) => ({ users: users.slice((page - 1) * size, page * size), total: users.length, lastPage: Math.ceil(users.length / size) }), runId);
assert.equal(validateProfileTestPair(found).length, 2);

const plan = JSON.parse(readFileSync("supabase/tests/s2-t110-profile-founder-evidence-plan.json", "utf8"));
assert.deepEqual(plan.accounts, ["timed", "no_time"]);
assert.equal(plan.checks.length, 10);
assert.match(plan.checks.join(" "), /no_time_summary_omits_houses_asc_mc_and_structural_moon/);
const runner = readFileSync("scripts/s2-profile-test-account-operator.mjs", "utf8");
const wrapper = readFileSync("scripts/run-s2-profile-test-bootstrap.zsh", "utf8");
assert.match(runner, /empty_profile_accounts_verified=2/);
assert.match(runner, /birth_data.*birth_data_history.*ai_profiles.*chat_threads/s);
assert.doesNotMatch(runner, /console\.|error\.message|stack|JSON\.stringify\(error/);
assert.match(wrapper, /stty -echo/);
assert.match(wrapper, /trap cleanup EXIT HUP INT TERM/);
const preflight = spawnSync("zsh", ["scripts/run-s2-profile-test-bootstrap.zsh"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /READY_FOR_PROFILE_TEST_KEY/);
assert.match(preflight.stdout, /network_calls=0 credentials_requested=0 accounts_created=0/);

console.log("S2-T110 timed/no-time Profile test bootstrap contracts passed; no account was created.");
