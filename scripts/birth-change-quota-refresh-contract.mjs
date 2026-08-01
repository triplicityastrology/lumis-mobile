import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  STAGING_PROJECT_REF,
  summarizeBirthChangeCounts,
  validateBirthChangeResetInput,
} from "./lib/staging-birth-change-reset.mjs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const screen = readFileSync("apps/mobile/src/features/birthDetails/BirthDetailsChangeScreen.tsx", "utf8");
const reset = readFileSync("scripts/reset-staging-birth-change-quota.mjs", "utf8");

assert.match(app, /accountRestoreFreshnessRef\.current\.begin\(\)/);
assert.match(app, /if \(!restoreTicket\.isCurrent\(\)\) return/);
assert.match(app, /setBirthDetailChanges\(accountState\.successfulBirthDetailChanges\)/);
assert.match(app, /setBirthDetailChanges\(0\);[\s\S]{0,180}setHasLocalDemoSession\(true\)/);
assert.match(accountState, /resolveBirthChangeQuota\(birthData\.successful_change_count\)\.successfulChanges/);
assert.match(screen, /resolveBirthChangeQuota\(successfulChanges\)\.remainingChanges/);
assert.match(screen, /\{remaining\} of \{BIRTH_CHANGE_LIMIT\} lifetime changes remaining/);

assert.deepEqual(validateBirthChangeResetInput({ projectRef: STAGING_PROJECT_REF, execute: false }), { mode: "dry_run" });
assert.deepEqual(validateBirthChangeResetInput({ projectRef: STAGING_PROJECT_REF, execute: false, countOnly: true }), { mode: "count_only" });
assert.throws(() => validateBirthChangeResetInput({ projectRef: "unknown", execute: false }), /WRONG_PROJECT/);
assert.throws(() => validateBirthChangeResetInput({ projectRef: STAGING_PROJECT_REF, execute: true }), /EXECUTE_DISABLED/);
assert.deepEqual(
  validateBirthChangeResetInput({
    projectRef: STAGING_PROJECT_REF,
    execute: true,
    confirmation: "RESET_ALL_STAGING_BIRTH_CHANGE_COUNTS",
  }),
  { mode: "execute" }
);
assert.throws(() => validateBirthChangeResetInput({ projectRef: STAGING_PROJECT_REF, execute: true, countOnly: true }), /MODE_CONFLICT/);
assert.deepEqual(summarizeBirthChangeCounts([
  { successful_change_count: 0 },
  { successful_change_count: 1 },
  { successful_change_count: 2 },
  { successful_change_count: 3 },
]), { accountsTotal: 4, count0: 1, count1: 1, count2: 1, count3: 1, accountsWithConsumedChanges: 3 });
assert.throws(() => summarizeBirthChangeCounts([{ successful_change_count: 4 }]), /COUNT_RESULT_INVALID/);
assert.match(reset, /\.from\("birth_data"\)[\s\S]{0,180}successful_change_count: 0[\s\S]{0,180}\.gte\("successful_change_count", 0\)/);
assert.match(reset, /after\.count0 !== after\.accountsTotal/);
assert.doesNotMatch(reset, /\.from\("(?:users|ai_profiles|account_entitlements)"\)|console\.|error\.message|JSON\.stringify/);

const dryRun = spawnSync("node", ["scripts/reset-staging-birth-change-quota.mjs", "--project-ref", STAGING_PROJECT_REF], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env }
});
assert.equal(dryRun.status, 0, dryRun.stderr);
assert.match(dryRun.stdout, /network_calls=0/);
assert.match(dryRun.stdout, /rows_changed=0/);

process.stdout.write("authoritative birth-change quota refresh and inert reset contracts passed\n");
