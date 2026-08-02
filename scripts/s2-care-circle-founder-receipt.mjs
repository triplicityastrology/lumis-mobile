import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  CARE_CIRCLE_RECEIPT_HEALTH_CHECKS,
  createCareCircleFounderReceipt,
  validateCareCircleFounderReceipt,
} from "./lib/care-circle-founder-receipt.mjs";

const RECEIPT_PATH = ".lumis-local/care-circle-founder-receipt.json";
const CONTROL_PATH = "supabase/tests/s2-t43-care-circle-function-pat-control.json";

try {
  const args = parseArgs(process.argv.slice(2));
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  if (args.mode === "preflight") {
    process.stdout.write(
      "READY_TO_WRITE_CARE_CIRCLE_RECEIPT\n"
      + "receipt_status=absent_until_verified_execution\n"
      + "network_calls=0 credentials_requested=0 filesystem_writes=0\n"
    );
  } else if (args.mode === "write") {
    const sourceCommit = git("rev-parse", "HEAD");
    const receipt = createCareCircleFounderReceipt({
      projectRef: control.project_ref,
      sourceCommit,
      functionSha256: control.function_sha256,
      functionVersion: args.functionVersion,
      deploymentStatus: args.deploymentStatus,
      healthStatus: args.healthStatus,
      healthChecks: args.healthChecks,
      issuedAt: Date.now(),
    });
    mkdirSync(dirname(RECEIPT_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write(
      "CARE_CIRCLE_RECEIPT_WRITTEN\n"
      + "receipt_scope=local_metadata_only\n"
      + "expires_within_hours=4\n"
    );
  } else {
    const receipt = JSON.parse(readFileSync(args.receiptPath, "utf8"));
    const sourceAncestorPresent =
      spawnSync("git", ["merge-base", "--is-ancestor", receipt.source_commit, "HEAD"], {
        stdio: "ignore",
      }).status === 0;
    const result = validateCareCircleFounderReceipt(receipt, {
      projectRef: control.project_ref,
      functionSha256: control.function_sha256,
      sourceAncestorPresent,
      now: Date.now(),
    });
    process.stdout.write([
      "CARE_CIRCLE_RECEIPT_VALID",
      `function_sha256=${result.functionSha256}`,
      `function_version=${result.functionVersion}`,
      `deployment_status=${result.deploymentStatus}`,
      `health_status=${result.healthStatus}`,
    ].join("\n") + "\n");
  }
} catch (error) {
  const code =
    error instanceof Error && /^STOP_S2_T126_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "STOP_S2_T126_RECEIPT_INVALID";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  if (values.length === 0) return { mode: "preflight" };
  if (values[0] === "--validate" && values.length === 2) {
    return { mode: "validate", receiptPath: values[1] };
  }
  const result = {
    mode: "",
    functionVersion: 0,
    deploymentStatus: "",
    healthStatus: "",
    healthChecks: [],
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--execute") result.mode = "write";
    else if (value === "--function-version") result.functionVersion = Number(values[++index]);
    else if (value === "--deployment-status") result.deploymentStatus = values[++index] ?? "";
    else if (value === "--health-status") result.healthStatus = values[++index] ?? "";
    else if (value === "--health-checks") result.healthChecks = (values[++index] ?? "").split(",");
    else throw new Error("STOP_S2_T126_ARGUMENTS_INVALID");
  }
  if (
    result.mode !== "write"
    || !Number.isInteger(result.functionVersion)
    || result.functionVersion <= 0
    || result.deploymentStatus !== "verified"
    || result.healthStatus !== "passed"
    || JSON.stringify(result.healthChecks) !== JSON.stringify(CARE_CIRCLE_RECEIPT_HEALTH_CHECKS)
  ) {
    throw new Error("STOP_S2_T126_VERIFIED_METADATA_REQUIRED");
  }
  return result;
}

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
