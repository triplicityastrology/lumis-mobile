import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { validateFourDigitPolicySources, validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

const seal = validateFourDigitSeal();
assert.equal(seal.locked_sources.length, 18);
assert.deepEqual(JSON.parse(readFileSync("supabase/tests/s2-t43-care-circle-function-pat-control.json", "utf8")).supporting_files.map(({ path }) => path), [
  "supabase/functions/care-circle/operation-boundary.ts",
  "supabase/functions/_shared/cors.ts"
]);

const policy = {
  migration: "interval '10 minutes'; attempt_count between 0 and 5",
  edge: "const code = /^\\d{4}$/;",
  client: "const PAIRING_CODE_PATTERN = /^\\d{4}$/;",
  mobile: 'maxLength={4} keyboardType="number-pad" Pairing code copied'
};
validateFourDigitPolicySources(policy);
assert.throws(() => validateFourDigitPolicySources({ ...policy, mobile: `${policy.mobile} LUMIS123` }), /STOP_S2_T146_STALE_CODE_POLICY/);
assert.throws(() => validateFourDigitPolicySources({ ...policy, mobile: "maxLength={8}" }), /STOP_S2_T146_MOBILE_BOUNDARY_MISSING/);
assert.throws(() => validateFourDigitPolicySources({ ...policy, migration: "interval '1 hour'" }), /STOP_S2_T146_MIGRATION_POLICY_MISSING/);

const temporary = mkdtempSync(join(tmpdir(), "s2-t146-"));
try {
  const drifted = structuredClone(seal);
  drifted.expiry_seconds = 3600;
  const path = join(temporary, "drift.json");
  writeFileSync(path, JSON.stringify(drifted));
  assert.throws(() => validateFourDigitSeal(path), /STOP_S2_T146_EXPIRY_INVALID/);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const run = spawnSync(process.execPath, ["scripts/s2-care-circle-four-digit-seal.mjs", "--check"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /S2_T146_FOUR_DIGIT_PARITY_SEALED/);
assert.match(run.stdout, /network_calls=0 deployment_actions=0/);
assert.doesNotMatch(run.stdout + run.stderr, /https?:\/\/|sb_secret_|pairing_code|SUPABASE_ACCESS_TOKEN/);
console.log("S2-T146 four-digit deployment parity seal contracts passed.");
