import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED_REF = "bmqhwofmdgebpcihjlnb";
const CONTROL_PATH = "config/s2-t84-reflection-deletion-readiness.json";
const PACKET_CONTROL = "supabase/tests/s2-t107-reflection-deletion-dashboard-control.json";
const EVIDENCE_PLAN = "supabase/tests/s2-t111-reflection-deletion-evidence-plan.json";

try {
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  const packet = JSON.parse(readFileSync(PACKET_CONTROL, "utf8"));
  const evidence = JSON.parse(readFileSync(EVIDENCE_PLAN, "utf8"));
  stopUnless(git("status", "--porcelain=v1") === "", "TREE_DIRTY");
  stopUnless(control.project_ref === EXPECTED_REF, "PROJECT_REF_MISMATCH");
  stopUnless(control.required_remote_predecessor === "0035", "PREDECESSOR_INVALID");
  stopUnless(control.prewrite_history_shape_status === "confirmed_t82_text_shape", "HISTORY_SHAPE_UNCONFIRMED");
  stopUnless(control.migration.version === "0036", "MIGRATION_SCOPE_INVALID");
  stopUnless(sha256(control.migration.path) === control.migration.sha256, "MIGRATION_CHECKSUM_MISMATCH");
  stopUnless(packet.migration.required_remote_predecessor_version === "0035", "PACKET_PREDECESSOR_INVALID");
  stopUnless(packet.migration.source_sha256 === control.migration.sha256, "PACKET_CHECKSUM_MISMATCH");
  stopUnless(evidence.required_migration === "0036", "EVIDENCE_SCOPE_INVALID");
  stopUnless(evidence.checks.includes("cross_owner_delete_denied") && evidence.checks.includes("anonymous_delete_denied"), "OWNER_MATRIX_INCOMPLETE");

  const runner = readFileSync("scripts/s2-reflection-deletion-evidence.mjs", "utf8");
  const wrapper = readFileSync("scripts/run-s2-reflection-deletion-evidence.zsh", "utf8");
  stopUnless(runner.includes("s2_evidence_run_id") && runner.includes("removeUsers"), "TAGGED_CLEANUP_MISSING");
  stopUnless(runner.includes("READY_FOR_0036_TEST_KEY") && wrapper.includes("stty -echo"), "EVIDENCE_OPERATOR_UNSAFE");
  const app = readFileSync("apps/mobile/App.tsx", "utf8");
  const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");
  const signed = readFileSync("apps/mobile/src/dev/FounderSignedInReflectionDeletionPanel.tsx", "utf8");
  stopUnless(app.includes('__DEV__ && founderTestRoute === "reflectionDeletion"'), "DEV_ROUTE_MISSING");
  stopUnless(hub.includes("Past Reflections deletion"), "DEV_ROUTE_MISSING");
  stopUnless(signed.includes("REAL SIGNED-IN STAGING MODE"), "SIGNED_IN_ROUTE_NOT_GATED");

  const migrationReceipt = receipt(".lumis-local/reflection-0036-migration-receipt.json", "migration", control.migration.sha256);
  const accountsReceipt = receipt(".lumis-local/reflection-0036-accounts-receipt.json", "accounts", control.migration.sha256);
  let nextAction = "migration_authorization_needed";
  if (migrationReceipt?.status === "applied_verified") nextAction = "deployment_evidence_needed";
  if (migrationReceipt?.status === "applied_verified" && accountsReceipt === null) nextAction = "disposable_accounts_needed";
  if (migrationReceipt?.status === "applied_verified" && accountsReceipt?.status === "two_tagged_accounts_ready") nextAction = "mobile_ready";

  process.stdout.write([
    "S2_T132_REFLECTION_READINESS_PASS",
    `source_sha=${git("rev-parse", "HEAD")}`,
    "migration=0036",
    `migration_sha256=${control.migration.sha256}`,
    "required_remote_predecessor=0035",
    "founder_route=present_dev_only",
    "evidence_scope=owner_cross_owner_tagged_cleanup",
    "local_demo=preserved",
    `next_action=${nextAction}`,
    "network_calls=0 sql_executed=0 credentials_requested=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T132_[A-Z0-9_]+$/.test(error.message)
    ? error.message : "STOP_S2_T132_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function receipt(path, kind, checksum) {
  if (!existsSync(path)) return null;
  const value = JSON.parse(readFileSync(path, "utf8"));
  const expected = ["kind", "migration_sha256", "project_ref", "status"];
  stopUnless(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected), "RECEIPT_SHAPE_UNSAFE");
  stopUnless(value.kind === kind && value.project_ref === EXPECTED_REF, "RECEIPT_SCOPE_INVALID");
  stopUnless(value.migration_sha256 === checksum, "RECEIPT_STALE");
  if (kind === "migration") stopUnless(value.status === "applied_verified", "RECEIPT_STATUS_INVALID");
  else stopUnless(value.status === "two_tagged_accounts_ready", "RECEIPT_STATUS_INVALID");
  return value;
}
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function stopUnless(condition, code) { if (!condition) throw new Error(`STOP_S2_T132_${code}`); }
