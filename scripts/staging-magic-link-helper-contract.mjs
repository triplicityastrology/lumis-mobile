import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const helperPath = "scripts/generate-staging-magic-link.mjs";
const helper = readFileSync(helperPath, "utf8");
const projectRef = "bmqhwofmdgebpcihjlnb";
const fixtureEmail = ["qa", "example.invalid"].join("@");
const fixtureRedirect = "exp://192.0.2.10:8081/--/auth/callback";

assert.match(helper, /const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb"/);
assert.match(helper, /projectRef !== STAGING_PROJECT_REF/);
assert.match(helper, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
assert.match(helper, /supabase\.auth\.admin\.generateLink/);
assert.match(helper, /spawn\("pbcopy"/);
assert.match(helper, /clipboard\.stdin\.end\(value\)/);
assert.doesNotMatch(
  helper,
  /console\.(?:log|info|warn|error)|process\.(?:stdout|stderr)\.write\([^)]*actionLink/,
  "the one-time link cannot be written to terminal output"
);

const validDryRun = runHelper({
  args: ["--project-ref", projectRef, "--dry-run"],
  email: fixtureEmail,
  redirect: fixtureRedirect
});
assert.equal(validDryRun.status, 0);
assert.match(validDryRun.stdout, /No network request was made/);
assert.doesNotMatch(validDryRun.stdout, /qa|192\.0\.2\.10|auth\/callback/i);

const wrongProject = runHelper({
  args: ["--project-ref", "production-ref-refused", "--dry-run"],
  email: fixtureEmail,
  redirect: fixtureRedirect
});
assert.notEqual(wrongProject.status, 0);
assert.match(wrongProject.stderr, /locked to the Lumis staging project/);

const localRedirect = runHelper({
  args: ["--project-ref", projectRef, "--dry-run"],
  email: fixtureEmail,
  redirect: "exp://localhost:8081/--/auth/callback"
});
assert.notEqual(localRedirect.status, 0);
assert.match(localRedirect.stderr, /non-local Expo Go callback/);

const unsafeRedirect = runHelper({
  args: ["--project-ref", projectRef, "--dry-run"],
  email: fixtureEmail,
  redirect: "https://untrusted.example/auth/callback"
});
assert.notEqual(unsafeRedirect.status, 0);

const missingSecretLiveRun = runHelper({
  args: ["--project-ref", projectRef],
  email: fixtureEmail,
  redirect: fixtureRedirect
});
assert.notEqual(missingSecretLiveRun.status, 0);
assert.match(missingSecretLiveRun.stderr, /SUPABASE_SERVICE_ROLE_KEY is required/);
assert.doesNotMatch(
  `${missingSecretLiveRun.stdout}${missingSecretLiveRun.stderr}`,
  /qa|192\.0\.2\.10|auth\/callback/i
);

console.log("staging magic-link helper contract checks passed");

function runHelper({ args, email, redirect }) {
  return spawnSync(process.execPath, [helperPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      LUMIS_STAGING_QA_EMAIL: email,
      LUMIS_STAGING_QA_REDIRECT_URL: redirect,
      SUPABASE_SERVICE_ROLE_KEY: ""
    }
  });
}
