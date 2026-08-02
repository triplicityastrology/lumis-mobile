import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONTROL = "supabase/tests/s2-t106-profile-function-deployment-control.json";

try {
  const args = parseArgs(process.argv.slice(2));
  const control = JSON.parse(readFileSync(CONTROL, "utf8"));
  stopUnless(args.projectRef === control.project_ref, "PROJECT_REF_MISMATCH");
  stopUnless(control.function_name === "profile", "FUNCTION_SCOPE_INVALID");
  stopUnless(control.recovery_mode === "redeploy_same_reviewed_live_worker_package_only", "RECOVERY_SCOPE_INVALID");
  stopUnless(sha256(control.function_path) === control.function_sha256, "FUNCTION_CHECKSUM_MISMATCH");
  for (const file of control.supporting_files) {
    stopUnless(sha256(file.path) === file.sha256, "SUPPORTING_CHECKSUM_MISMATCH");
  }
  stopUnless(
    git("merge-base", "--is-ancestor", control.minimum_safe_function_commit, "HEAD") === "",
    "UNSAFE_FUNCTION_ANCESTRY",
  );
  stopUnless(git("status", "--porcelain=v1") === "", "TREE_DIRTY");
  const sourceSha = git("rev-parse", "HEAD");
  stopUnless(/^[0-9a-f]{40}$/.test(sourceSha), "SOURCE_SHA_INVALID");
  process.stdout.write(
    [
      "READY_FOR_PROFILE_PAT",
      `project_ref=${control.project_ref}`,
      `source_sha=${sourceSha}`,
      `function_name=${control.function_name}`,
      `function_sha256=${control.function_sha256}`,
      "recovery=same_reviewed_live_worker_package_only",
      "network_calls=0 token_requested=0 deployment_actions=0",
    ].join("\n") + "\n",
  );
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T106_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "STOP_S2_T106_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function parseArgs(values) {
  if (values.length !== 2 || values[0] !== "--project-ref") {
    throw new Error("STOP_S2_T106_ARGUMENTS_INVALID");
  }
  return { projectRef: values[1] };
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T106_${code}`);
}
