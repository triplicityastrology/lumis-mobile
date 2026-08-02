import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

import {
  CARE_CIRCLE_HEALTH_PROJECT_REF,
  classifyCareCircleHealthFailure,
  classifyCareCircleHealthResponse,
} from "./lib/care-circle-function-health.mjs";

const CONTROL_PATH = "supabase/tests/s2-t43-care-circle-function-pat-control.json";
const FUNCTION_PATH = "supabase/functions/care-circle/index.ts";

class HealthStop {
  constructor(code) {
    this.code = code;
  }
}

try {
  validateFourDigitSeal();
  const args = parseArgs(process.argv.slice(2));
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  stopUnless(args.projectRef === CARE_CIRCLE_HEALTH_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(control.project_ref === CARE_CIRCLE_HEALTH_PROJECT_REF, "CONTROL_INVALID");
  stopUnless(control.function_name === "care-circle", "CONTROL_INVALID");
  const checksum = createHash("sha256").update(readFileSync(FUNCTION_PATH)).digest("hex");
  stopUnless(checksum === control.function_sha256, "CHECKSUM_MISMATCH");

  if (!args.execute) {
    process.stdout.write(
      `READY_FOR_DEPLOYED_FUNCTION_HEALTH\nproject_ref=${args.projectRef}\nfunction_name=care-circle\nfunction_sha256=${checksum}\nnetwork_calls=0 credentials_requested=0\n`
    );
  } else {
    await executeHealth(args, checksum);
  }
} catch (error) {
  const code =
    error instanceof HealthStop && /^STOP_S2_T104_[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : "STOP_S2_T104_UNKNOWN_FAILURE";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

async function executeHealth(args, checksum) {
  stopUnless(args.deployedSha256 === checksum, "WRONG_VERSION");
  stopUnless(Number.isInteger(args.deployedVersion) && args.deployedVersion > 0, "WRONG_VERSION");
  const token = process.env.S2_T104_DISPOSABLE_ACCESS_TOKEN;
  stopUnless(typeof token === "string" && token.length > 0, "DISPOSABLE_TOKEN_REQUIRED");
  const endpoint = `https://${CARE_CIRCLE_HEALTH_PROJECT_REF}.supabase.co/functions/v1/care-circle`;

  const unauthenticated = await safeRequest(endpoint, undefined, "unauthenticated");
  emitOrStop(unauthenticated);
  const malformed = await safeRequest(endpoint, token, "malformed");
  emitOrStop(malformed);
  process.stdout.write(
    `S2_T104_FUNCTION_HEALTH_PASS\nfunction_name=care-circle\nfunction_version=${args.deployedVersion}\nfunction_sha256=${checksum}\ncheck=unauthenticated_rejection result=passed\ncheck=malformed_request_rejection result=passed\n`
  );
}

async function safeRequest(endpoint, token, check) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: check === "malformed" ? JSON.stringify({ action: "unsupported" }) : "{}",
    });
    const body = await response.text();
    return classifyCareCircleHealthResponse({
      check,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
    });
  } catch {
    return classifyCareCircleHealthFailure("network");
  }
}

function emitOrStop(result) {
  if (!result.ok) throw new HealthStop(result.code);
}

function parseArgs(values) {
  const parsed = {
    execute: false,
    projectRef: "",
    deployedVersion: null,
    deployedSha256: "",
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--execute") parsed.execute = true;
    else if (value === "--project-ref") parsed.projectRef = values[++index] ?? "";
    else if (value === "--deployed-version") parsed.deployedVersion = Number(values[++index]);
    else if (value === "--deployed-sha256") parsed.deployedSha256 = values[++index] ?? "";
    else throw new HealthStop("STOP_S2_T104_ARGUMENTS_INVALID");
  }
  return parsed;
}

function stopUnless(condition, code) {
  if (!condition) throw new HealthStop(`STOP_S2_T104_${code}`);
}
