import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { resolveCareCircleFounderReadiness } from "./lib/care-circle-founder-readiness.mjs";
import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

const CONTROL = "supabase/tests/s2-t141-care-circle-live-readiness-control.json";
const MIGRATION_NOTE = "docs/qa/S2-T140-care-circle-0037-dashboard-readiness.md";

try {
  if (process.argv.length !== 2) stop("ARGUMENTS_INVALID");
  validateFourDigitSeal();
  const control = JSON.parse(readFileSync(CONTROL, "utf8"));
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  if (control.project_ref !== "bmqhwofmdgebpcihjlnb") stop("PROJECT_CONTROL_INVALID");
  if (control.execution_default !== "zero_network_read_only") stop("MODE_INVALID");
  if (JSON.stringify(control.required_remote_migration_versions) !== JSON.stringify(["0032", "0033", "0034", "0037"])) stop("MIGRATION_CHAIN_INVALID");
  if (JSON.stringify(control.required_custom_secret_names) !== JSON.stringify(["CARE_CIRCLE_PAIRING_SECRET"])) stop("SECRET_SCOPE_INVALID");

  for (const entry of control.locked_sources) {
    const actual = createHash("sha256").update(readFileSync(entry.path)).digest("hex");
    if (actual !== entry.sha256) stop("SOURCE_DRIFT");
  }
  if (control.required_operator_scripts.some((name) => typeof packageJson.scripts?.[name] !== "string")) stop("OPERATOR_MISSING");
  for (const required of [
    "care-circle:founder-session",
    "test:s2-care-circle-function-health",
    "test:s2-care-circle-two-account-operator",
  ]) {
    if (typeof packageJson.scripts?.[required] !== "string") stop("EVIDENCE_BOUNDARY_MISSING");
  }

  const migrationNote = readFileSync(MIGRATION_NOTE, "utf8");
  const migrationRecorded = /0037 parity recorded: yes/u.test(migrationNote);
  if (!migrationRecorded && !/Status: source-only, inert, unrun/u.test(migrationNote)) stop("MIGRATION_EVIDENCE_AMBIGUOUS");

  const result = resolveCareCircleFounderReadiness({
    migration0037Parity: migrationRecorded ? "recorded" : "not_recorded",
    customSecret: "not_recorded",
    functionDeployment: "not_recorded",
    functionHealth: "not_run",
    bootstrap: "source_ready",
    launcher: "source_ready",
    evidenceCleanup: "source_ready",
  });

  process.stdout.write([
    "S2_T141_CARE_CIRCLE_LIVE_READINESS",
    `migration_0037=${result.migration0037Parity}`,
    `custom_pairing_secret=${result.customSecret}`,
    `function_deployment=${result.functionDeployment}`,
    `function_health=${result.functionHealth}`,
    `two_account_bootstrap=${result.bootstrap}`,
    `recovered_product_route=${result.launcher}`,
    `evidence_cleanup=${result.evidenceCleanup}`,
    "local_rehearsal=available_non_live",
    `next_safe_action=${result.nextAction}`,
    "network_calls=0 credentials_requested=0 live_success_inferred=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T141_[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "STOP_S2_T141_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function stop(reason) {
  throw new Error(`STOP_S2_T141_${reason}`);
}
