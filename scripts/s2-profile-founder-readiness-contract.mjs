import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = readFileSync("scripts/s2-profile-founder-readiness.mjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const marker of [
  "bmqhwofmdgebpcihjlnb", "s2-t106-profile-function-deployment-control.json",
  "minimum_safe_function_commit", "FUNCTION_CHECKSUM_MISMATCH", "SUPPORTING_CHECKSUM_MISMATCH",
  "CONFIGURATION_SOURCE_CONTRACT_MISSING", "FounderProfileTestPanel.tsx", "FOUNDER_ROUTE_MISSING",
  '"pat_needed"', '"deployment_evidence_needed"', '"disposable_accounts_needed"', '"mobile_ready"',
  "redeploy_same_reviewed_live_worker_package_only",
]) assert.ok(source.includes(marker), marker);
assert.doesNotMatch(source, /fetch\(|https?:\/\/|SUPABASE_ACCESS_TOKEN|functions deploy|console\./);
assert.equal(pkg.scripts["profile:founder-readiness"], "node scripts/s2-profile-founder-readiness.mjs");
assert.equal(pkg.scripts["test:s2-profile-founder-readiness"], "node scripts/s2-profile-founder-readiness-contract.mjs");
assert.match(pkg.scripts["test:profile"], /test:s2-profile-founder-readiness/);
assert.match(pkg.scripts["test:mobile-native-bundle-contract"], /test:s2-profile-founder-readiness/);
const result = spawnSync(process.execPath, ["scripts/s2-profile-founder-readiness.mjs"], { encoding: "utf8" });
if (result.status === 0) {
  assert.match(result.stdout, /S2_T131_PROFILE_READINESS_PASS/);
  assert.match(result.stdout, /next_action=pat_needed/);
  assert.match(result.stdout, /network_calls=0 credentials_requested=0 deployment_actions=0/);
} else assert.equal(result.stderr, "STOP_S2_T131_TREE_DIRTY\n");
assert.doesNotMatch(result.stdout + result.stderr, /https?:\/\/|@|token|secret/i);
console.log("S2-T131 canonical Profile Founder readiness contract passed.");
