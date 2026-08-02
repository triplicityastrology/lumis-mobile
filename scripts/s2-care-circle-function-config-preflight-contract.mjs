import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const script = "scripts/s2-care-circle-function-config-preflight.mjs";
const controlPath =
  "supabase/tests/s2-t48-care-circle-function-config-control.json";
const control = JSON.parse(readFileSync(controlPath, "utf8"));
const source = readFileSync(script, "utf8");
const functionSource = readFileSync(control.function_path, "utf8");
assert.match(control.previous_function_sha256, /^[0-9a-f]{64}$/);
assert.equal(control.supporting_files.length, 1);
assert.match(control.supporting_files[0].sha256, /^[0-9a-f]{64}$/);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const names = control.source_authorized_runtime_names.join(",");

const passed = run(control.project_ref, control.function_sha256, names);
assert.equal(passed.status, 0, passed.stderr);
assert.match(passed.stdout, /^S2_T48_CARE_CIRCLE_CONFIG_PREFLIGHT_PASS$/m);
assert.match(passed.stdout, /notification_provider_scheduler_billing_scope=absent/);
assert.match(passed.stdout, /network_calls=0 values_read=0 deployment_actions=0 activation=0/);
assert.equal(passed.stderr, "");

for (const [label, projectRef, checksum, suppliedNames, expectedCode] of [
  ["wrong project", "not-staging", control.function_sha256, names, "PROJECT_REF_MISMATCH"],
  ["wrong checksum", control.project_ref, "0".repeat(64), names, "REVIEWED_CHECKSUM_MISMATCH"],
  ["missing name", control.project_ref, control.function_sha256, names.replace(",SUPABASE_URL", ""), "CONFIGURATION_SCOPE_INVALID"],
  ["notification", control.project_ref, control.function_sha256, `${names},NOTIFICATION_TOKEN_ENCRYPTION_KEY`, "PROHIBITED_SCOPE_PRESENT"],
  ["provider", control.project_ref, control.function_sha256, `${names},EXPO_ACCESS_TOKEN`, "PROHIBITED_SCOPE_PRESENT"],
  ["scheduler", control.project_ref, control.function_sha256, `${names},SCHEDULER_CRON`, "PROHIBITED_SCOPE_PRESENT"],
  ["billing", control.project_ref, control.function_sha256, `${names},STRIPE_SECRET_KEY`, "PROHIBITED_SCOPE_PRESENT"],
  ["value-like input", control.project_ref, control.function_sha256, `${names},SECRET=value`, "NAMES_INVALID"]
]) {
  const result = run(projectRef, checksum, suppliedNames);
  assert.equal(result.status, 1, label);
  assert.equal(result.stdout, "", label);
  assert.equal(result.stderr, `STOP_S2_T48_${expectedCode}\n`, label);
  assert.doesNotMatch(result.stderr, /not-staging|EXPO|STRIPE|value|stack|Error/i);
}

assert.deepEqual(control.source_authorized_runtime_names, [
  "CARE_CIRCLE_PAIRING_SECRET",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL"
]);
assert.deepEqual(control.required_custom_secret_names, [
  "CARE_CIRCLE_PAIRING_SECRET"
]);
assert.deepEqual(control.platform_provided_runtime_names, [
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL"
]);
const functionConfigurationNames = [
  ...functionSource.matchAll(/Deno\.env\.get\("([A-Z][A-Z0-9_]*)"\)/g)
].map((match) => match[1]).sort();
assert.deepEqual(
  functionConfigurationNames,
  [...control.source_authorized_runtime_names].sort()
);
for (const marker of [
  "NOTIFICATION", "EXPO", "APNS", "FCM", "PROVIDER", "SCHEDULER",
  "CRON", "BILLING", "PAYMENT", "STRIPE", "REVENUECAT"
]) {
  assert.ok(control.prohibited_scope_name_markers.includes(marker));
}
assert.doesNotMatch(
  source,
  /process\.env|Deno\.env|fetch\s*\(|https?:\/\/|execFile|spawn|supabase\s|functions\s+deploy|secrets\s+(?:set|list)/i
);
assert.match(source, /local_names_only_inert/);
assert.equal(
  packageJson.scripts["test:s2-care-circle-function-config-preflight"],
  "node scripts/s2-care-circle-function-config-preflight-contract.mjs && node scripts/s2-care-circle-function-health-contract.mjs"
);

process.stdout.write(
  "S2-T48 Care Circle names-only configuration preflight contracts passed; no values, network, or deployment were used.\n"
);

function run(projectRef, checksum, suppliedNames) {
  return spawnSync(process.execPath, [
    script,
    "--project-ref", projectRef,
    "--reviewed-function-sha256", checksum,
    "--configuration-names", suppliedNames
  ], { encoding: "utf8", env: {} });
}
