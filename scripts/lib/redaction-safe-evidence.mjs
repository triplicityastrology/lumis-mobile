const SAFE_RUN_ID = /^(?:[0-9]{13}-[a-f0-9]+|not-created)$/;
const SAFE_CHECK_NAME = /^[a-z0-9_]{3,80}$/;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,80}$/;

export class RedactedEvidenceFailure extends Error {
  constructor(checkName, errorCode) {
    super("Redacted evidence check failed.");
    this.name = "RedactedEvidenceFailure";
    this.checkName = normalizeCheckName(checkName);
    this.errorCode = normalizeErrorCode(errorCode);
    this.stack = undefined;
  }
}

export function safeCheck(
  condition,
  checkName,
  errorCode = "EVIDENCE_CHECK_FAILED"
) {
  if (!condition) {
    throw new RedactedEvidenceFailure(checkName, errorCode);
  }
}

export async function runRedactedEvidenceMain(
  { getRunId, boundaryCheck, boundaryCode },
  operation
) {
  try {
    await operation();
  } catch (error) {
    const known = error instanceof RedactedEvidenceFailure;
    const payload = {
      run_id: normalizeRunId(getRunId()),
      check: known
        ? error.checkName
        : normalizeCheckName(boundaryCheck),
      error_code: known
        ? error.errorCode
        : normalizeErrorCode(boundaryCode)
    };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    process.exitCode = 1;
  }
}

function normalizeRunId(value) {
  return SAFE_RUN_ID.test(value ?? "") ? value : "not-created";
}

function normalizeCheckName(value) {
  return SAFE_CHECK_NAME.test(value ?? "") ? value : "evidence_boundary";
}

function normalizeErrorCode(value) {
  return SAFE_ERROR_CODE.test(value ?? "")
    ? value
    : "EVIDENCE_INTERNAL_FAILURE";
}
