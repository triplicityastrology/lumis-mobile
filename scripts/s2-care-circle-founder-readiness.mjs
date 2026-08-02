import { readFileSync } from "node:fs";

import { resolveCareCircleFounderReadiness } from "./lib/care-circle-founder-readiness.mjs";

const MIGRATION_EVIDENCE = "docs/qa/S2-T94-care-circle-staging-migration-execution-evidence.md";
const DEPLOYMENT_EVIDENCE = "docs/qa/S2-T95-care-circle-function-deployment-attempt.md";

try {
  if (process.argv.length !== 2) throw new Error("STOP_S2_T123_ARGUMENTS_INVALID");
  const migrationEvidence = readFileSync(MIGRATION_EVIDENCE, "utf8");
  const deploymentEvidence = readFileSync(DEPLOYMENT_EVIDENCE, "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  const migrationsRecorded =
    /Execution order: `0032` -> `0033` -> `0034`/.test(migrationEvidence)
    && /Transaction results: passed, passed, passed/.test(migrationEvidence)
    && /Final parity row count: 3/.test(migrationEvidence)
    && /Unexpected versions in the controlled query: 0/.test(migrationEvidence);
  const functionVerified =
    /Deployment attempted: yes/.test(deploymentEvidence)
    && /Function deployment verified: yes/.test(deploymentEvidence);
  const functionNotRecorded =
    /Fresh temporary PAT available: no/.test(deploymentEvidence)
    && /Deployment attempted: no/.test(deploymentEvidence);
  if (!functionVerified && !functionNotRecorded) {
    throw new Error("STOP_S2_T123_DEPLOYMENT_EVIDENCE_AMBIGUOUS");
  }

  const requiredScripts = [
    "care-circle:function-health",
    "care-circle:bootstrap-two-account",
    "start:care-circle-founder",
    "care-circle:founder-session",
    "founder-test:cleanup",
  ];
  if (requiredScripts.some((name) => typeof packageJson.scripts?.[name] !== "string")) {
    throw new Error("STOP_S2_T123_OPERATOR_MISSING");
  }

  const result = resolveCareCircleFounderReadiness({
    migrationsParity: migrationsRecorded ? "recorded" : "not_recorded",
    functionDeployment: functionVerified ? "verified" : "not_recorded",
    functionHealth: "not_run",
    bootstrap: "source_ready",
    launcher: "source_ready",
    evidenceCleanup: "source_ready",
  });

  process.stdout.write([
    "S2_T123_CARE_CIRCLE_FOUNDER_READINESS",
    `migrations_parity=${result.migrationsParity}`,
    `function_deployment=${result.functionDeployment}`,
    "function_marker=expected_source_locked",
    `function_health=${result.functionHealth}`,
    `two_account_bootstrap=${result.bootstrap}`,
    `normal_expo_launcher=${result.launcher}`,
    `evidence_cleanup=${result.evidenceCleanup}`,
    `next_safe_action=${result.nextAction}`,
    "network_calls=0 credentials_requested=0 live_success_inferred=0",
  ].join("\n") + "\n");
} catch (error) {
  const code =
    error instanceof Error && /^STOP_S2_T123_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "STOP_S2_T123_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
