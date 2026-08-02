import { createHash } from "node:crypto";

export const CARE_CIRCLE_RECEIPT_SCHEMA = "care_circle_founder_receipt_v1";
export const CARE_CIRCLE_RECEIPT_MAX_AGE_MS = 4 * 60 * 60 * 1000;
export const CARE_CIRCLE_RECEIPT_HEALTH_CHECKS = Object.freeze([
  "unauthenticated_rejection",
  "malformed_request_rejection",
]);

const PAYLOAD_KEYS = Object.freeze([
  "schema",
  "project_ref",
  "source_commit",
  "function_sha256",
  "function_version",
  "deployment_status",
  "health_status",
  "health_checks",
  "issued_at",
  "expires_at",
]);

export function createCareCircleFounderReceipt(input) {
  const issuedAt = new Date(input.issuedAt);
  const expiresAt = new Date(issuedAt.getTime() + CARE_CIRCLE_RECEIPT_MAX_AGE_MS);
  const payload = {
    schema: CARE_CIRCLE_RECEIPT_SCHEMA,
    project_ref: input.projectRef,
    source_commit: input.sourceCommit,
    function_sha256: input.functionSha256,
    function_version: input.functionVersion,
    deployment_status: input.deploymentStatus,
    health_status: input.healthStatus,
    health_checks: [...input.healthChecks],
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  validatePayloadShape(payload);
  return { ...payload, receipt_digest: digestPayload(payload) };
}

export function validateCareCircleFounderReceipt(receipt, expected) {
  stopUnless(receipt && typeof receipt === "object" && !Array.isArray(receipt), "SHAPE_INVALID");
  stopUnless(
    JSON.stringify(Object.keys(receipt).sort())
      === JSON.stringify([...PAYLOAD_KEYS, "receipt_digest"].sort()),
    "FIELDS_INVALID"
  );
  const payload = Object.fromEntries(PAYLOAD_KEYS.map((key) => [key, receipt[key]]));
  validatePayloadShape(payload);
  stopUnless(receipt.project_ref === expected.projectRef, "WRONG_PROJECT");
  stopUnless(receipt.function_sha256 === expected.functionSha256, "FUNCTION_CHECKSUM_MISMATCH");
  stopUnless(receipt.deployment_status === "verified", "DEPLOYMENT_UNVERIFIED");
  stopUnless(receipt.health_status === "passed", "HEALTH_UNVERIFIED");
  stopUnless(expected.sourceAncestorPresent === true, "SOURCE_STALE");
  stopUnless(receipt.receipt_digest === digestPayload(payload), "DIGEST_INVALID");

  const issuedAt = Date.parse(receipt.issued_at);
  const expiresAt = Date.parse(receipt.expires_at);
  stopUnless(Number.isFinite(issuedAt) && Number.isFinite(expiresAt), "TIME_INVALID");
  stopUnless(expiresAt - issuedAt === CARE_CIRCLE_RECEIPT_MAX_AGE_MS, "WINDOW_INVALID");
  stopUnless(expected.now >= issuedAt && expected.now < expiresAt, "EXPIRED");
  return {
    functionSha256: receipt.function_sha256,
    functionVersion: receipt.function_version,
    deploymentStatus: receipt.deployment_status,
    healthStatus: receipt.health_status,
  };
}

function validatePayloadShape(payload) {
  stopUnless(payload.schema === CARE_CIRCLE_RECEIPT_SCHEMA, "SCHEMA_INVALID");
  stopUnless(/^[a-z]{20}$/u.test(payload.project_ref), "PROJECT_INVALID");
  stopUnless(/^[0-9a-f]{40}$/u.test(payload.source_commit), "SOURCE_INVALID");
  stopUnless(/^[0-9a-f]{64}$/u.test(payload.function_sha256), "FUNCTION_CHECKSUM_INVALID");
  stopUnless(Number.isInteger(payload.function_version) && payload.function_version > 0, "FUNCTION_VERSION_INVALID");
  stopUnless(payload.deployment_status === "verified", "DEPLOYMENT_UNVERIFIED");
  stopUnless(payload.health_status === "passed", "HEALTH_UNVERIFIED");
  stopUnless(
    JSON.stringify(payload.health_checks) === JSON.stringify(CARE_CIRCLE_RECEIPT_HEALTH_CHECKS),
    "HEALTH_CHECKS_INVALID"
  );
  stopUnless(typeof payload.issued_at === "string" && typeof payload.expires_at === "string", "TIME_INVALID");
}

function digestPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T126_${code}`);
}
