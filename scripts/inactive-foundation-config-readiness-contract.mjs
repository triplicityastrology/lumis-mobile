import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const checkerPath = "scripts/inactive-foundation-config-readiness.mjs";
const runbookPath =
  "docs/qa/S2-T13-inactive-foundation-secret-configuration-readiness.md";
const checker = readFileSync(checkerPath, "utf8");
const runbook = readFileSync(runbookPath, "utf8");
const node = process.execPath;
const expectedRef = "bmqhwofmdgebpcihjlnb";
const requiredNames = [
  "CARE_CIRCLE_PAIRING_SECRET",
  "NOTIFICATION_TOKEN_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const ok = spawnSync(
  node,
  [
    checkerPath,
    "--project-ref",
    expectedRef,
    "--present-names",
    requiredNames.join(","),
  ],
  { encoding: "utf8", env: {} }
);
assert.equal(ok.status, 0);
assert.match(ok.stdout, /local_inert/);
assert.match(ok.stdout, /network_calls=0 configuration_changes=0 provider_activation=0/);
for (const name of requiredNames) {
  assert.match(ok.stdout, new RegExp(`configuration_name=${name} status=declared`));
}

const wrongProject = spawnSync(
  node,
  [
    checkerPath,
    "--project-ref",
    "production-is-forbidden",
    "--present-names",
    requiredNames.join(","),
  ],
  { encoding: "utf8", env: {} }
);
assert.notEqual(wrongProject.status, 0);
assert.match(wrongProject.stderr, /READINESS_STAGING_PROJECT_REQUIRED/);

const execute = spawnSync(
  node,
  [
    checkerPath,
    "--execute",
    "--project-ref",
    expectedRef,
    "--present-names",
    requiredNames.join(","),
  ],
  { encoding: "utf8", env: {} }
);
assert.notEqual(execute.status, 0);
assert.match(execute.stderr, /READINESS_EXECUTION_FORBIDDEN/);

assert.doesNotMatch(checker, /process\.env|Deno\.env|fetch\(|https?:|createHash|crypto|execSync/);
assert.doesNotMatch(
  checker,
  /dlx\s+supabase|supabase@|wrangler|curl|functions deploy|db push|secrets set/i
);
assert.match(runbook, /names and status only/i);
assert.match(runbook, /static previews/i);
assert.match(runbook, /must remain[\s\S]{0,20}absent/i);
assert.match(
  runbook,
  /does not read, print, hash, copy, compare, or[\s\S]{0,20}transmit/i
);
assert.match(runbook, /No notification provider credentials/i);
assert.match(runbook, /bmqhwofmdgebpcihjlnb/);
assert.doesNotMatch(
  runbook,
  /supabase@latest|pnpm\s+dlx\s+supabase|secrets set|db push|functions deploy|wrangler/i
);

console.log("inactive foundation configuration readiness contracts passed");
