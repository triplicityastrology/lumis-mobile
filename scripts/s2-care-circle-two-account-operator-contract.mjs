import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  TWO_ACCOUNT_PROJECT_REF,
  discoverExactRunUsers,
  expectedSyntheticEmail,
  validateExactRunPair,
  validateSetupInput
} from "./lib/care-circle-two-account-operator.mjs";

const runId = "s2t75-20260801t120000z-abcdef12";
const valid = {
  runId,
  projectRef: TWO_ACCOUNT_PROJECT_REF,
  careeEmail: expectedSyntheticEmail(runId, "caree"),
  careePassword: "caree-test-password-123!",
  carerEmail: expectedSyntheticEmail(runId, "carer"),
  carerPassword: "carer-test-password-456!"
};
assert.deepEqual(validateSetupInput(valid), { ok: true });
for (const mutate of [
  (value) => { value.projectRef = "wrong"; },
  (value) => { value.careeEmail = "person@example.com"; },
  (value) => { value.carerEmail = value.careeEmail; },
  (value) => { value.careePassword = "short"; },
  (value) => { value.carerPassword = value.careePassword; }
]) {
  const fixture = structuredClone(valid);
  mutate(fixture);
  assert.throws(() => validateSetupInput(fixture), /STOP_S2_T75_/);
}

const syntheticUser = (id, role = undefined, targetRunId = undefined) => ({
  id,
  user_metadata: role ? {
    s2_evidence_suite: "s2t75",
    s2_evidence_run_id: targetRunId ?? runId,
    s2_evidence_role: role
  } : {}
});
const population = Array.from({ length: 1_205 }, (_, index) => syntheticUser(`synthetic-${index}`));
population[1_101] = syntheticUser("target-caree", "caree");
population[1_204] = syntheticUser("target-carer", "carer");
const fetchPopulationPage = async (page, pageSize) => ({
  users: population.slice((page - 1) * pageSize, page * pageSize),
  total: population.length,
  lastPage: Math.ceil(population.length / pageSize)
});
const discovered = await discoverExactRunUsers(fetchPopulationPage, runId);
assert.deepEqual(validateExactRunPair(discovered).map((user) => user.id).sort(), ["target-caree", "target-carer"]);

await assert.rejects(
  discoverExactRunUsers(async (page, pageSize) => {
    const result = await fetchPopulationPage(page, pageSize);
    if (page === 3) result.users[0] = population[0];
    return result;
  }, runId),
  /STOP_S2_T75_AUTH_PAGE_DUPLICATE/
);
await assert.rejects(
  discoverExactRunUsers(async (page, pageSize) => {
    const result = await fetchPopulationPage(page, pageSize);
    if (page > 1) result.total += 1;
    return result;
  }, runId),
  /STOP_S2_T75_AUTH_TOTAL_CHANGED/
);
await assert.rejects(
  discoverExactRunUsers(fetchPopulationPage, runId, { pageSize: 200, maxPages: 6 }),
  /STOP_S2_T75_AUTH_PAGINATION_UNBOUNDED/
);
assert.throws(() => validateExactRunPair(discovered.slice(0, 1)), /STOP_S2_T75_RUN_PAIR_INCOMPLETE/);

const runner = readFileSync("scripts/s2-care-circle-two-account-operator.mjs", "utf8");
const wrapper = readFileSync("scripts/run-s2-care-circle-two-account-operator.sh", "utf8");
assert.match(runner, /accounts_created=2/);
assert.match(runner, /account_modes_verified=2/);
assert.match(runner, /verifyCapabilities/);
assert.match(runner, /auth_accounts_remaining=0/);
assert.match(runner, /run_rows_remaining=0/);
assert.match(runner, /s2_evidence_run_id/);
assert.match(runner, /discoverExactRunUsers/);
assert.doesNotMatch(runner, /console\.(?:log|error)|error\.message|JSON\.stringify\(error|stack/);
assert.match(wrapper, /stty -echo/);
assert.match(wrapper, /unset S2_T75_SECRET_KEY/);
assert.match(wrapper, /dedicated_qa_key_revocation=required_after_cleanup/);
assert.doesNotMatch(wrapper, />[^&/]|tee |set -x|printenv|env >|\.env/);

const preflight = spawnSync("bash", ["scripts/run-s2-care-circle-two-account-operator.sh", "preflight"], {
  cwd: process.cwd(), encoding: "utf8", env: { ...process.env }
});
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /S2_T75_LOCAL_PREFLIGHT_PASS/);
assert.match(preflight.stdout, /network_calls=0/);
assert.doesNotMatch(preflight.stdout + preflight.stderr, /@example|password|secret|token|https?:\/\//i);

process.stdout.write("S2-T75 two-account operator contracts passed; no staging call or account creation ran.\n");
