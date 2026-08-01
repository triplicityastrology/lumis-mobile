import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = "apps/mobile/test-workbenches/care-circle-staging";
const plan = JSON.parse(
  readFileSync(
    "supabase/tests/s2-t41-two-account-evidence-plan.json",
    "utf8"
  )
);
const session = readFileSync(`${root}/CareCircleStagingSessionGate.tsx`, "utf8");
const screen = readFileSync(`${root}/CareCircleStagingWorkbench.tsx`, "utf8");
const port = readFileSync(`${root}/stagingWorkbenchPort.ts`, "utf8");
const outcomeIntegrity = readFileSync(
  `${root}/workbenchOutcomeIntegrity.ts`,
  "utf8"
);
const client = readFileSync(
  "apps/mobile/src/services/inactiveCareCircleClient.ts",
  "utf8"
);
const releaseApp = readFileSync("apps/mobile/App.tsx", "utf8");
const runbook = readFileSync(
  "docs/qa/S2-T41-two-account-founder-evidence-readiness.md",
  "utf8"
);

assert.equal(plan.project_ref, "bmqhwofmdgebpcihjlnb");
assert.deepEqual(plan.actors, {
  caree: 1,
  carer: 1,
  existing_accounts_allowed: false
});
assert.equal(plan.ordered_device_steps[0], "caree_sign_in");
assert.equal(
  plan.ordered_device_steps.at(-1),
  "operator_cleanup_two_disposable_accounts"
);
assert(plan.forbidden_in_this_run.includes("sixth_carer_capacity"));
assert(plan.forbidden_in_this_run.includes("second_carer"));

for (const sourceRequirement of [
  [session, /signInWithPassword|sessionPort\.signIn/],
  [session, /Switch account/],
  [session, /signOut\(\)/],
  [screen, /create_pairing_code/],
  [screen, /submit_pairing_code/],
  [screen, /Pending Caree acceptance · no authority/],
  [screen, /accept_relationship/],
  [outcomeIntegrity, /active_confirmed/],
  [outcomeIntegrity, /relationship\?\.status === "active"/],
  [screen, /pause_care/],
  [screen, /resume_care/],
  [screen, /remove_relationship/],
  [screen, /Refresh status/],
  [port, /list_care_relationships/],
  [port, /relationship_status/],
  [client, /pending_caree_acceptance/]
]) {
  assert.match(sourceRequirement[0], sourceRequirement[1]);
}

assert.doesNotMatch(
  releaseApp,
  /CareCircleStagingWorkbench|test-workbenches\/care-circle-staging/
);
assert.match(runbook, /one disposable Caree and one disposable Carer/i);
assert.match(runbook, /pending Caree acceptance.*no authority/is);
assert.match(runbook, /pause.*resume.*remove/is);
assert.match(runbook, /deletes both disposable accounts/i);
assert.match(runbook, /cleanup count of two/i);
assert.match(runbook, /Do not run the capacity test/i);
assert.doesNotMatch(
  runbook,
  /supabase (?:db push|functions deploy)|notification-device|scheduler|billing/i
);

process.stdout.write(
  "S2-T41 two-account readiness passed locally; no staging account or request was created.\n"
);
