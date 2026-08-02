import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  CARE_CIRCLE_RECEIPT_HEALTH_CHECKS,
  CARE_CIRCLE_RECEIPT_MAX_AGE_MS,
  createCareCircleFounderReceipt,
  validateCareCircleFounderReceipt,
} from "./lib/care-circle-founder-receipt.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t43-care-circle-function-pat-control.json", "utf8"));
const issuedAt = Date.parse("2026-08-02T00:00:00.000Z");
const valid = createCareCircleFounderReceipt({
  projectRef: control.project_ref,
  sourceCommit: "a".repeat(40),
  functionSha256: control.function_sha256,
  functionVersion: 7,
  deploymentStatus: "verified",
  healthStatus: "passed",
  healthChecks: CARE_CIRCLE_RECEIPT_HEALTH_CHECKS,
  issuedAt,
});
assert.deepEqual(
  validateCareCircleFounderReceipt(valid, {
    projectRef: control.project_ref,
    functionSha256: control.function_sha256,
    sourceAncestorPresent: true,
    now: issuedAt + 1,
  }),
  {
    functionSha256: control.function_sha256,
    functionVersion: 7,
    deploymentStatus: "verified",
    healthStatus: "passed",
  }
);

for (const [name, mutate, code] of [
  ["wrong project", (value) => { value.project_ref = "wrongprojectrefvalue"; }, "WRONG_PROJECT"],
  ["hand edited", (value) => { value.function_version = 8; }, "DIGEST_INVALID"],
  ["expired", () => {}, "EXPIRED"],
  ["stale source", () => {}, "SOURCE_STALE"],
]) {
  const fixture = structuredClone(valid);
  mutate(fixture);
  assert.throws(
    () => validateCareCircleFounderReceipt(fixture, {
      projectRef: control.project_ref,
      functionSha256: control.function_sha256,
      sourceAncestorPresent: name !== "stale source",
      now: name === "expired" ? issuedAt + CARE_CIRCLE_RECEIPT_MAX_AGE_MS : issuedAt + 1,
    }),
    new RegExp(`STOP_S2_T126_${code}`),
    name
  );
}

const cli = readFileSync("scripts/s2-care-circle-founder-receipt.mjs", "utf8");
const launcher = readFileSync("scripts/start-care-circle-founder-expo.sh", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
assert.match(gitignore, /^\.lumis-local\/$/m);
assert.match(cli, /flag: "wx"/);
assert.match(cli, /mode: 0o600/);
assert.doesNotMatch(cli, /fetch\s*\(|SUPABASE_ACCESS_TOKEN|SERVICE_ROLE/);
assert.match(launcher, /care-circle-founder-receipt\.json/);
assert.match(launcher, /--validate/);
assert.doesNotMatch(launcher, /S2_CARE_CIRCLE_(?:DEPLOYMENT_GATE|HEALTH_GATE|DEPLOYED_SHA256)/);
assert.doesNotMatch(launcher, /printf[^\n]*(?:receipt|function_sha256|function_version)/i);

const preflight = spawnSync("node", ["scripts/s2-care-circle-founder-receipt.mjs"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /filesystem_writes=0/);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["care-circle:founder-receipt"],
  "node scripts/s2-care-circle-founder-receipt.mjs"
);
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-founder-receipt/);

console.log("S2-T126 local Care Circle deployment and health receipt contracts passed.");
