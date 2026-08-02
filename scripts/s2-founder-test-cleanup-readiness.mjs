import { readFileSync } from "node:fs";

try {
  const args = parseArgs(process.argv.slice(2));
  const control = JSON.parse(readFileSync("supabase/tests/s2-t108-founder-test-cleanup-control.json", "utf8"));
  stopUnless(args.projectRef === control.project_ref, "PROJECT_REF_MISMATCH");
  stopUnless(control.execution_default === "local_validation_only", "DEFAULT_MODE_INVALID");
  stopUnless(control.supported_scopes.length === 3, "SUPPORTED_SCOPE_INVALID");
  stopUnless(control.unsupported_scopes.length === 2, "UNSUPPORTED_SCOPE_INVALID");
  stopUnless(control.unsupported_scopes.every((item) => item.reason.includes("no_") || item.reason.includes("terminal_")), "UNSUPPORTED_REASON_INVALID");
  process.stdout.write([
    "READY_FOR_FOUNDER_TEST_CLEANUP_KEY",
    `project_ref=${control.project_ref}`,
    "supported=exact_run_accounts,care_circle_owner_rows,account_owned_reflections_and_charts",
    "unsupported=standalone_reflections_or_charts,device_local_demo_artifacts",
    "network_calls=0 credentials_requested=0 rows_changed=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T108_[A-Z0-9_]+$/.test(error.message)
    ? error.message : "STOP_S2_T108_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  if (values.length !== 2 || values[0] !== "--project-ref") throw new Error("STOP_S2_T108_ARGUMENTS_INVALID");
  return { projectRef: values[1] };
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T108_${code}`);
}
