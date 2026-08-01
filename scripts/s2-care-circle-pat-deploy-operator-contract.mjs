import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const operator = readFileSync("scripts/run-s2-care-circle-pat-deploy.zsh", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

for (const required of [
  'EXPECTED_REF="bmqhwofmdgebpcihjlnb"',
  'PINNED_CLI="2.109.1"',
  'FUNCTION_NAME="care-circle"',
  "--) shift ;;",
  "READY_FOR_PAT",
  "--approved-technical-ancestor",
  "s2-care-circle-clean-descendant-authority.mjs",
  "PAT_READY",
  "IFS= read -r -s",
  "s2-care-circle-final-parity-preflight.mjs",
  "s2-care-circle-function-pat-preflight.mjs",
  "s2-care-circle-function-config-preflight.mjs",
  "validate-supabase-secret-names.mjs",
  "validate-supabase-function-list.mjs",
  'functions deploy "$FUNCTION_NAME"',
  "classify-supabase-pat-revocation.mjs",
  "STOP_PAT_REVOCATION_UNVERIFIED",
  "STOP_PAT_REVOCATION_NOT_EFFECTIVE",
  "PAT_REVOKE_VERIFIED",
]) {
  assert.ok(operator.includes(required), `operator omits ${required}`);
}
assert.doesNotMatch(operator, /supabase\s+login|db push|notification-device/);
assert.doesNotMatch(operator, /--approved-source-sha|APPROVED_SOURCE_SHA/);
assert.doesNotMatch(operator, /SUPABASE_ACCESS_TOKEN=.*sbp_|tee .*TOKEN|echo .*TOKEN/);
assert.match(operator, /if \[\[ "\$MODE" != "execute" \]\][\s\S]*READY_FOR_PAT/);
assert.match(operator, /cleanup_token[\s\S]*unset SUPABASE_ACCESS_TOKEN/);
assert.equal(
  packageJson.scripts["test:s2-care-circle-pat-deploy-operator"],
  "node scripts/s2-care-circle-pat-deploy-operator-contract.mjs && node scripts/s2-care-circle-clean-descendant-authority-contract.mjs"
);

const safeSecrets = run(
  "scripts/validate-supabase-secret-names.mjs",
  ["--required", "CARE_CIRCLE_PAIRING_SECRET,SUPABASE_URL"],
  JSON.stringify([
    { name: "CARE_CIRCLE_PAIRING_SECRET", digest: "not-emitted" },
    { name: "SUPABASE_URL", digest: "not-emitted" },
    { name: "UNRELATED_EXISTING_SECRET", digest: "not-emitted" },
  ])
);
assert.equal(safeSecrets.status, 0);
assert.equal(safeSecrets.stdout, "CONFIGURATION_NAMES_CONFIRMED\n");
assert.doesNotMatch(safeSecrets.stdout + safeSecrets.stderr, /digest|not-emitted/);

const missingSecret = run(
  "scripts/validate-supabase-secret-names.mjs",
  ["--required", "CARE_CIRCLE_PAIRING_SECRET"],
  "[]"
);
assert.notEqual(missingSecret.status, 0);
assert.equal(missingSecret.stdout + missingSecret.stderr, "");

const safeFunction = run(
  "scripts/validate-supabase-function-list.mjs",
  ["--function", "care-circle"],
  JSON.stringify([
    {
      id: "must-not-be-emitted",
      name: "care-circle",
      version: 7,
      status: "ACTIVE",
      updated_at: "2026-08-01T09:30:00Z",
    },
  ])
);
assert.equal(safeFunction.status, 0);
assert.match(safeFunction.stdout, /function_name=care-circle[\s\S]*function_version=7/);
assert.doesNotMatch(safeFunction.stdout + safeFunction.stderr, /must-not-be-emitted/);

for (const hostile of [
  "not-json",
  JSON.stringify([{ name: "care-circle", version: "7", status: "ACTIVE", updated_at: "2026-08-01T09:30:00Z" }]),
  JSON.stringify([{ name: "care-circle", version: 7, status: "ACTIVE", updated_at: "unsafe" }]),
]) {
  const result = run(
    "scripts/validate-supabase-function-list.mjs",
    ["--function", "care-circle"],
    hostile
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout + result.stderr, "");
}

process.stdout.write(
  "S2-T102 PAT deployment operator contracts passed; READY_FOR_PAT remains inert.\n"
);

function run(file, args, input) {
  return spawnSync(process.execPath, [file, ...args], { encoding: "utf8", input });
}
