import { createHash } from "node:crypto";

export const REHEARSAL_EVIDENCE_SCHEMA = "s2_t158_care_circle_0037_rehearsal_evidence_v1";
export const REHEARSAL_MIGRATION_SHA256 = "3a5deda8546d5255e51c0cece16e67687cd71a63743f923a49aebf94f2f5852c";

export function validateRehearsalEvidence(value) {
  stopUnless(value && typeof value === "object" && !Array.isArray(value), "ENVELOPE_INVALID");
  exactKeys(value, [
    "schema", "project_ref", "project_classification", "evidence_kind",
    "predecessor_versions", "history_parity", "migration", "residue",
    "rollback_result", "rows_exposed", "private_values_exposed",
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
  rejectUnsafeStrings(value);
  return value;
}

export function evidenceSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactKeys(value, keys, code) {
  stopUnless(value && typeof value === "object" && !Array.isArray(value), code);
  stopUnless(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), code);
}

function rejectUnsafeStrings(value) {
  const text = JSON.stringify(value);
  stopUnless(!/(?:https?:\/\/|postgres(?:ql)?:\/\/|select\s|insert\s|update\s|delete\s|begin;|rollback;|password|secret|token|email|user[_-]?id)/iu.test(text), "UNSAFE_VALUE_DETECTED");
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T158_${code}`);
}
