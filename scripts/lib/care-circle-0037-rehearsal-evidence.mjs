import { createHash } from "node:crypto";

export const REHEARSAL_EVIDENCE_SCHEMA = "s2_t158_care_circle_0037_rehearsal_evidence_v1";
export const REHEARSAL_MIGRATION_SHA256 = "45ef4469f72ad5188f6f66fede61717eac4b9f4fd598daccc3eafa003d3dd46d";
export const REHEARSAL_OPERATOR_SHA256 = "68af532ed66d4b6025e217ae069bd3b3da46bf53ea6a9a8ddae1db5767cbfcd2";
export const REHEARSAL_OPERATOR_ID = "s2_t140_0037_dashboard_rollback_rehearsal";

export function validateRehearsalEvidence(value, trustedSession) {
  validateTrustedSession(trustedSession);
  stopUnless(value && typeof value === "object" && !Array.isArray(value), "ENVELOPE_INVALID");
  exactKeys(value, [
    "schema", "project_ref", "project_classification", "evidence_kind",
    "predecessor_versions", "history_parity", "migration", "residue",
    "rollback_result", "rows_exposed", "private_values_exposed", "attestation",
  ], "ENVELOPE_FIELDS_INVALID");
  stopUnless(value.schema === REHEARSAL_EVIDENCE_SCHEMA, "SCHEMA_INVALID");
  stopUnless(value.project_ref === "bmqhwofmdgebpcihjlnb" && value.project_classification === "staging_test_only", "PROJECT_INVALID");
  stopUnless(value.evidence_kind === "dashboard_rollback_rehearsal_redacted", "EVIDENCE_KIND_INVALID");
  stopUnless(JSON.stringify(value.predecessor_versions) === JSON.stringify(["0032", "0033", "0034"]), "PREDECESSOR_PARITY_INVALID");
  stopUnless(value.history_parity === "matched", "HISTORY_PARITY_INVALID");
  exactKeys(value.migration, ["version", "name", "sha256"], "MIGRATION_FIELDS_INVALID");
  stopUnless(value.migration.version === "0037" && value.migration.name === "four_digit_care_pairing_codes" && value.migration.sha256 === REHEARSAL_MIGRATION_SHA256, "MIGRATION_INVALID");
  exactKeys(value.residue, ["schema_objects", "history_rows"], "RESIDUE_FIELDS_INVALID");
  stopUnless(value.residue.schema_objects === 0 && value.residue.history_rows === 0, "RESIDUE_NOT_ZERO");
  stopUnless(value.rollback_result === "passed", "ROLLBACK_NOT_PASSED");
  stopUnless(value.rows_exposed === false && value.private_values_exposed === false, "PRIVACY_BOUNDARY_INVALID");
  exactKeys(value.attestation, ["schema", "operator_id", "operator_sha256", "session_nonce"], "ATTESTATION_FIELDS_INVALID");
  stopUnless(value.attestation.schema === "s2_t164_rehearsal_attestation_v1" &&
    value.attestation.operator_id === REHEARSAL_OPERATOR_ID &&
    value.attestation.operator_sha256 === REHEARSAL_OPERATOR_SHA256 &&
    /^[0-9a-f]{64}$/u.test(value.attestation.session_nonce), "ATTESTATION_INVALID");
  stopUnless(sha(value.attestation.session_nonce) === trustedSession.nonce_sha256, "ATTESTATION_NONCE_INVALID");
  rejectUnsafeStrings(value);
  return value;
}

export function evidenceSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createTrustedSession(sessionNonce) {
  stopUnless(typeof sessionNonce === "string" && /^[0-9a-f]{64}$/u.test(sessionNonce), "ATTESTATION_NONCE_INVALID");
  return {
    schema: "s2_t164_rehearsal_session_v1",
    status: "issued",
    project_ref: "bmqhwofmdgebpcihjlnb",
    migration_sha256: REHEARSAL_MIGRATION_SHA256,
    operator_id: REHEARSAL_OPERATOR_ID,
    operator_sha256: REHEARSAL_OPERATOR_SHA256,
    nonce_sha256: sha(sessionNonce),
    consumed: false,
  };
}

function validateTrustedSession(value) {
  exactKeys(value, ["schema", "status", "project_ref", "migration_sha256", "operator_id", "operator_sha256", "nonce_sha256", "consumed"], "ATTESTATION_REQUIRED");
  stopUnless(value.schema === "s2_t164_rehearsal_session_v1" && value.status === "issued" && value.consumed === false, "ATTESTATION_REPLAYED");
  stopUnless(value.project_ref === "bmqhwofmdgebpcihjlnb" && value.migration_sha256 === REHEARSAL_MIGRATION_SHA256, "ATTESTATION_SCOPE_INVALID");
  stopUnless(value.operator_id === REHEARSAL_OPERATOR_ID && value.operator_sha256 === REHEARSAL_OPERATOR_SHA256 && /^[0-9a-f]{64}$/u.test(value.nonce_sha256), "ATTESTATION_SOURCE_INVALID");
}

function exactKeys(value, keys, code) {
  stopUnless(value && typeof value === "object" && !Array.isArray(value), code);
  stopUnless(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), code);
}

function rejectUnsafeStrings(value) {
  const text = JSON.stringify(value);
  stopUnless(!/(?:https?:\/\/|postgres(?:ql)?:\/\/|select\s|insert\s|update\s|delete\s|begin;|rollback;|password|secret|token|email|user[_-]?id)/iu.test(text), "UNSAFE_VALUE_DETECTED");
}

function sha(value) { return createHash("sha256").update(value).digest("hex"); }

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T158_${code}`);
}
