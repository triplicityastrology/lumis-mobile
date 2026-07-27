import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const checkerPath = "scripts/staging-auth-readiness.mjs";
const runbookPath = "docs/qa/staging-auth-readiness.md";
const checker = readFileSync(checkerPath, "utf8");
const runbook = readFileSync(runbookPath, "utf8");
const projectRef = "bmqhwofmdgebpcihjlnb";

assert.match(checker, /const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb"/);
assert.match(checker, /EXPO_PUBLIC_SUPABASE_URL/);
assert.match(checker, /supabase\/\.temp\/project-ref/);
assert.match(checker, /LUMIS_STAGING_AUTH_SITE_URL/);
assert.match(checker, /LUMIS_STAGING_AUTH_REDIRECT_URLS/);
assert.match(checker, /smtpMode === "custom"/);
assert.match(checker, /built-in provider selected; its project email rate limit applies/);
assert.doesNotMatch(
  checker,
  /generateLink|signInWithOtp|SUPABASE_SERVICE_ROLE_KEY|createClient|fetch\(|pbcopy|clipboard|action_link/,
  "readiness checking cannot generate credentials, authenticate, or call Supabase"
);
assert.match(runbook, /must begin inside Lumis/);
assert.match(runbook, /normal\s+`signInWithOtp`/);
assert.match(runbook, /two messages per\s+hour/i);
assert.doesNotMatch(
  runbook,
  /generateLink|SUPABASE_SERVICE_ROLE_KEY|one-time link copied|pbcopy/,
  "the corrected runbook cannot retain the Admin link-generation path"
);

const valid = runChecker({
  projectRef,
  smtpMode: "builtin",
  siteUrl: "http://localhost:8081",
  redirects:
    "exp://192.0.2.10:8081/--/auth/callback,lumis://auth/callback"
});
assert.equal(valid.status, 0);
assert.match(valid.stdout, /readiness check passed/);
assert.match(valid.stdout, /project email rate limit applies/);
assert.doesNotMatch(valid.stdout, /192\.0\.2\.10|localhost:8081|lumis:\/\/auth/);

const customSmtp = runChecker({
  projectRef,
  smtpMode: "custom",
  siteUrl: "https://staging.example.invalid",
  redirects: "exps://staging.example.invalid/--/auth/callback"
});
assert.equal(customSmtp.status, 0);
assert.match(customSmtp.stdout, /custom staging SMTP confirmed/);

const wrongProject = runChecker({
  projectRef: "production-ref-refused",
  smtpMode: "builtin",
  siteUrl: "http://localhost:8081",
  redirects: "lumis://auth/callback"
});
assert.notEqual(wrongProject.status, 0);
assert.match(wrongProject.stderr, /locked to Lumis staging/);

const unsafeRedirect = runChecker({
  projectRef,
  smtpMode: "custom",
  siteUrl: "http://localhost:8081",
  redirects: "https://untrusted.example/auth/callback"
});
assert.notEqual(unsafeRedirect.status, 0);
assert.match(unsafeRedirect.stderr, /unsupported callback shape/);

console.log("staging Auth readiness contract checks passed");

function runChecker({ projectRef, smtpMode, siteUrl, redirects }) {
  return spawnSync(
    process.execPath,
    [
      checkerPath,
      "--project-ref",
      projectRef,
      "--smtp-mode",
      smtpMode
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        LUMIS_STAGING_AUTH_REDIRECT_URLS: redirects,
        LUMIS_STAGING_AUTH_SITE_URL: siteUrl
      }
    }
  );
}
