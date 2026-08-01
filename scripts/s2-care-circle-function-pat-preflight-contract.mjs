import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const checker = readFileSync(
  "scripts/s2-care-circle-function-pat-preflight.mjs",
  "utf8"
);
const revocationClassifier =
  "scripts/classify-supabase-pat-revocation.mjs";
const runbook = readFileSync(
  "docs/setup/s2-t09-care-circle-staging-deployment-recovery-runbook.md",
  "utf8"
);
const control = JSON.parse(
  readFileSync(
    "supabase/tests/s2-t43-care-circle-function-pat-control.json",
    "utf8"
  )
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const codeBlocks = [...runbook.matchAll(/```(?:bash|zsh|sh)?\n([\s\S]*?)```/g)]
  .map((match) => match[1])
  .join("\n");

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.supabase_cli_version, "2.109.1");
assert.equal(control.function_name, "care-circle");
assert.match(control.function_sha256, /^[0-9a-f]{64}$/);
assert.match(control.previous_function_sha256, /^[0-9a-f]{64}$/);
assert.equal(control.supporting_files.length, 1);
assert.match(control.supporting_files[0].sha256, /^[0-9a-f]{64}$/);
assert.deepEqual(control.minimum_permissions, [
  "edge_functions_read",
  "edge_functions_write"
]);

assert.match(checker, /SUPABASE_ACCESS_TOKEN[\s\S]*undefined/);
assert.match(checker, /git\("status", "--porcelain=v1"\)/);
assert.match(checker, /PAT_PREFLIGHT_TREE_DIRTY/);
assert.match(checker, /PAT_PREFLIGHT_FUNCTION_CHECKSUM_MISMATCH/);
assert.doesNotMatch(
  checker,
  /https?:\/\/|\bfetch\s*\(|functions\s+deploy|projects\s+list|supabase\s+login/
);

for (const required of [
  "IFS= read -r -s SUPABASE_ACCESS_TOKEN",
  "trap cleanup_pat EXIT HUP INT TERM",
  "supabase@2.109.1 functions list",
  "supabase@2.109.1 functions deploy",
  "care-circle",
  "--project-ref \"$EXPECTED_REF\"",
  "unset SUPABASE_ACCESS_TOKEN",
  "Revoke the temporary PAT",
  "PAT_REVOKE_VERIFIED",
  "STOP_PAT_REVOCATION_UNVERIFIED",
  "classify-supabase-pat-revocation.mjs",
  "edge_functions_read",
  "edge_functions_write"
]) {
  assert(runbook.includes(required), `Runbook omits ${required}.`);
}
assert.doesNotMatch(
  runbook,
  /(?:^|\n)\s*(?:"[^"]+"\s+dlx\s+)?supabase(?:@\S+)?\s+login(?:\s|$)/m
);
assert.doesNotMatch(codeBlocks, /SUPABASE_ACCESS_TOKEN=.*sbp_/);
assert.doesNotMatch(codeBlocks, /(?:>|tee).*SUPABASE_ACCESS_TOKEN/);
assert.match(
  runbook,
  /printf '%s' "\$REVOCATION_OUTPUT" \| \\\n\s+node scripts\/classify-supabase-pat-revocation\.mjs >\/dev\/null/
);

assert.equal(
  packageJson.scripts["test:s2-care-circle-function-pat-preflight"],
  "node scripts/s2-care-circle-function-pat-preflight-contract.mjs"
);

const wrongRef = spawnSync(
  process.execPath,
  [
    "scripts/s2-care-circle-function-pat-preflight.mjs",
    "--project-ref",
    "not-staging",
    "--approved-source-sha",
    "0".repeat(40)
  ],
  { encoding: "utf8" }
);
assert.notEqual(wrongRef.status, 0);
assert.doesNotMatch(wrongRef.stdout + wrongRef.stderr, /sbp_|token value/i);
assert.match(wrongRef.stdout + wrongRef.stderr, /PAT_PREFLIGHT_PROJECT_REF_MISMATCH/);

for (const accepted of [
  "Management API returned HTTP 401: Unauthorized",
  "unexpected status 403: authorization denied"
]) {
  const result = classify(accepted);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PAT_REVOCATION_AUTH_DENIAL_CONFIRMED\n");
  assert.equal(result.stderr, "");
}

for (const rejected of [
  "network request failed with HTTP 401",
  "HTTP 403: project ref not found",
  "command not found: supabase",
  "unexpected CLI failure",
  "HTTP 500: internal error",
  "HTTP 401"
]) {
  const result = classify(rejected);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

const sensitiveMarker = "sbp_private_fixture_value";
const sensitiveFailure = classify(
  `HTTP 500 unknown failure ${sensitiveMarker}`
);
assert.doesNotMatch(
  sensitiveFailure.stdout + sensitiveFailure.stderr,
  new RegExp(sensitiveMarker)
);

process.stdout.write(
  "S2-T43 PAT preflight contract passed; no network or credential operation ran.\n"
);

function classify(input) {
  return spawnSync(process.execPath, [revocationClassifier], {
    encoding: "utf8",
    input
  });
}
