import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED_REF = "bmqhwofmdgebpcihjlnb";
const CONTROL_PATH = "supabase/tests/s2-t106-profile-function-deployment-control.json";
const DEPLOYMENT_RECEIPT = ".lumis-local/profile-function-deployment-receipt.json";
const ACCOUNTS_RECEIPT = ".lumis-local/profile-founder-accounts-receipt.json";

try {
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  stopUnless(control.project_ref === EXPECTED_REF, "PROJECT_REF_MISMATCH");
  stopUnless(control.function_name === "profile", "FUNCTION_SCOPE_INVALID");
  stopUnless(control.recovery_mode === "redeploy_same_reviewed_live_worker_package_only", "RECOVERY_SCOPE_INVALID");
  stopUnless(git("status", "--porcelain=v1") === "", "TREE_DIRTY");
  stopUnless(git("merge-base", "--is-ancestor", control.minimum_safe_function_commit, "HEAD") === "", "ANCESTRY_INVALID");
  stopUnless(sha256(control.function_path) === control.function_sha256, "FUNCTION_CHECKSUM_MISMATCH");
  for (const file of control.supporting_files) stopUnless(sha256(file.path) === file.sha256, "SUPPORTING_CHECKSUM_MISMATCH");

  const profileSource = readFileSync(control.function_path, "utf8");
  for (const name of control.required_configuration_names) {
    stopUnless(profileSource.includes(name), "CONFIGURATION_SOURCE_CONTRACT_MISSING");
  }
  const app = readFileSync("apps/mobile/App.tsx", "utf8");
  const hub = readFileSync("apps/mobile/src/dev/FounderTestHub.tsx", "utf8");
  const panel = readFileSync("apps/mobile/src/dev/FounderProfileTestPanel.tsx", "utf8");
  stopUnless(app.includes('__DEV__ && founderTestRoute === "profileTest"'), "FOUNDER_ROUTE_MISSING");
  stopUnless(hub.includes("Timed and no-time Profile test"), "FOUNDER_ROUTE_MISSING");
  stopUnless(panel.includes("Real disposable staging accounts only"), "FOUNDER_ROUTE_NOT_LIVE_GATED");
  stopUnless(panel.includes("resolveProfileFounderTestBoundary"), "FOUNDER_ROUTE_NOT_LIVE_GATED");

  const deployment = readOptionalReceipt(DEPLOYMENT_RECEIPT, "deployment", control.function_sha256);
  const accounts = readOptionalReceipt(ACCOUNTS_RECEIPT, "accounts", control.function_sha256);
  let nextAction = "pat_needed";
  if (deployment?.status === "deployed" && deployment.evidence_status !== "verified") nextAction = "deployment_evidence_needed";
  if (deployment?.status === "deployed" && deployment.evidence_status === "verified") nextAction = "disposable_accounts_needed";
  if (deployment?.evidence_status === "verified" && accounts?.status === "two_disposable_accounts_ready") nextAction = "mobile_ready";

  process.stdout.write([
    "S2_T131_PROFILE_READINESS_PASS",
    `source_sha=${git("rev-parse", "HEAD")}`,
    `function_sha256=${control.function_sha256}`,
    "project_ref=approved_staging_exact",
    "configuration_names=source_authorized",
    "founder_profile_route=present_dev_only",
    `next_action=${nextAction}`,
    "network_calls=0 credentials_requested=0 deployment_actions=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T131_[A-Z0-9_]+$/.test(error.message)
    ? error.message : "STOP_S2_T131_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function readOptionalReceipt(path, kind, functionSha256) {
  if (!existsSync(path)) return null;
  const value = JSON.parse(readFileSync(path, "utf8"));
  const keys = kind === "deployment"
    ? ["evidence_status", "function_sha256", "kind", "project_ref", "status"]
    : ["function_sha256", "kind", "project_ref", "status"];
  stopUnless(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys), "RECEIPT_SHAPE_UNSAFE");
  stopUnless(value.kind === kind && value.project_ref === EXPECTED_REF, "RECEIPT_SCOPE_INVALID");
  stopUnless(value.function_sha256 === functionSha256, "RECEIPT_STALE");
  if (kind === "deployment") {
    stopUnless(value.status === "deployed", "RECEIPT_STATUS_INVALID");
    stopUnless(["pending", "verified"].includes(value.evidence_status), "RECEIPT_STATUS_INVALID");
  } else stopUnless(value.status === "two_disposable_accounts_ready", "RECEIPT_STATUS_INVALID");
  return value;
}

function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function stopUnless(condition, code) { if (!condition) throw new Error(`STOP_S2_T131_${code}`); }
