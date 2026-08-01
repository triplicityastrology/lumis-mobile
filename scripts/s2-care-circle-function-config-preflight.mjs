import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CONTROL_PATH =
  "supabase/tests/s2-t48-care-circle-function-config-control.json";

class PreflightStop extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

try {
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  const args = parseArgs(process.argv.slice(2));
  stopIf(control.schema_version !== 1, "CONTROL_INVALID");
  stopIf(control.execution_default !== "local_names_only_inert", "CONTROL_INVALID");
  stopIf(args.projectRef !== control.project_ref, "PROJECT_REF_MISMATCH");
  stopIf(
    args.reviewedFunctionSha256 !== control.function_sha256,
    "REVIEWED_CHECKSUM_MISMATCH"
  );

  const actualChecksum = createHash("sha256")
    .update(readFileSync(control.function_path))
    .digest("hex");
  stopIf(actualChecksum !== control.function_sha256, "SOURCE_CHECKSUM_MISMATCH");
  for (const supporting of control.supporting_files ?? []) {
    const checksum = createHash("sha256")
      .update(readFileSync(supporting.path))
      .digest("hex");
    stopIf(checksum !== supporting.sha256, "SOURCE_CHECKSUM_MISMATCH");
  }

  const names = parseNames(args.configurationNames);
  const required = [...control.required_configuration_names].sort();
  stopIf(
    names.some((name) =>
      control.prohibited_scope_name_markers.some((marker) => name.includes(marker))
    ),
    "PROHIBITED_SCOPE_PRESENT"
  );
  stopIf(
    JSON.stringify(names) !== JSON.stringify(required),
    "CONFIGURATION_SCOPE_INVALID"
  );

  process.stdout.write(
    [
      "S2_T48_CARE_CIRCLE_CONFIG_PREFLIGHT_PASS",
      `project_ref=${control.project_ref}`,
      `function_name=${control.function_name}`,
      `function_sha256=${actualChecksum}`,
      `configuration_names=${names.join(",")}`,
      "notification_provider_scheduler_billing_scope=absent",
      "network_calls=0 values_read=0 deployment_actions=0 activation=0"
    ].join("\n") + "\n"
  );
} catch (error) {
  const code = error instanceof PreflightStop ? error.code : "INPUT_INVALID";
  process.stderr.write(`STOP_S2_T48_${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  stopIf(values.length !== 6, "ARGUMENTS_INVALID");
  const allowed = new Set([
    "--project-ref",
    "--reviewed-function-sha256",
    "--configuration-names"
  ]);
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    stopIf(!allowed.has(flag) || typeof value !== "string", "ARGUMENTS_INVALID");
    stopIf(Object.prototype.hasOwnProperty.call(parsed, flag), "ARGUMENTS_INVALID");
    parsed[flag] = value;
  }
  return {
    projectRef: parsed["--project-ref"],
    reviewedFunctionSha256: parsed["--reviewed-function-sha256"],
    configurationNames: parsed["--configuration-names"]
  };
}

function parseNames(value) {
  stopIf(typeof value !== "string" || value.length === 0, "NAMES_INVALID");
  const names = value.split(",");
  stopIf(
    names.some((name) => !/^[A-Z][A-Z0-9_]*$/u.test(name)) ||
      new Set(names).size !== names.length,
    "NAMES_INVALID"
  );
  return [...names].sort();
}

function stopIf(condition, code) {
  if (condition) throw new PreflightStop(code);
}
