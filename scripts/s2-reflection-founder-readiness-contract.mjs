import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = readFileSync("scripts/s2-reflection-founder-readiness.mjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const marker of [
  "s2-t84-reflection-deletion-readiness.json", "s2-t107-reflection-deletion-dashboard-control.json",
  "s2-t111-reflection-deletion-evidence-plan.json", 'required_remote_predecessor === "0035"',
  "MIGRATION_CHECKSUM_MISMATCH", "PACKET_CHECKSUM_MISMATCH", "cross_owner_delete_denied",
  "s2_evidence_run_id", "removeUsers", "FounderSignedInReflectionDeletionPanel.tsx",
  '"migration_authorization_needed"', '"deployment_evidence_needed"',
  '"disposable_accounts_needed"', '"mobile_ready"', "local_demo=preserved",
]) assert.ok(source.includes(marker), marker);
assert.doesNotMatch(source, /fetch\(|https?:\/\/|SUPABASE_ACCESS_TOKEN|supabase db|console\./);
assert.equal(pkg.scripts["reflection:founder-readiness"], "node scripts/s2-reflection-founder-readiness.mjs");
assert.equal(pkg.scripts["test:s2-reflection-founder-readiness"], "node scripts/s2-reflection-founder-readiness-contract.mjs");
assert.match(pkg.scripts["test:reflection-deletion-readiness"], /test:s2-reflection-founder-readiness/);
assert.match(pkg.scripts["test:mobile-native-bundle-contract"], /test:s2-reflection-founder-readiness/);
const result = spawnSync(process.execPath, ["scripts/s2-reflection-founder-readiness.mjs"], { encoding: "utf8" });
if (result.status === 0) {
  assert.match(result.stdout, /S2_T132_REFLECTION_READINESS_PASS/);
  assert.match(result.stdout, /next_action=migration_authorization_needed/);
  assert.match(result.stdout, /network_calls=0 sql_executed=0 credentials_requested=0/);
} else assert.equal(result.stderr, "STOP_S2_T132_TREE_DIRTY\n");
assert.doesNotMatch(result.stdout + result.stderr, /https?:\/\/|@|token|secret/i);
console.log("S2-T132 canonical reflection deletion readiness contract passed.");
