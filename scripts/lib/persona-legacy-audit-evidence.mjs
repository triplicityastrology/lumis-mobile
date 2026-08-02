export const EXPECTED_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const EXPECTED_PACKET_SHA256 = "93afa88fd4997fbb96c45303e23b4d42a3b94bcdf8f020042dfb3cb75c863593";

const ROOT_KEYS = ["schema", "project_ref", "project_classification", "authority", "packet_sha256", "transaction_mode", "boundaries", "migration_authorized"];
const BOUNDARY_KEYS = ["boundary_name", "stable_code_records", "accepted_legacy_alias_records", "unknown_label_only_records", "null_empty_records"];
const BOUNDARIES = ["chat_message_request_snapshots", "chat_threads", "users"];

export function validatePersonaLegacyAuditEvidence(value) {
  if (!isRecord(value) || !sameKeys(value, ROOT_KEYS)) return stop("SCHEMA_INVALID");
  if (value.schema !== "s2_t161_persona_legacy_selection_audit_v1") return stop("SCHEMA_INVALID");
  if (value.project_ref !== EXPECTED_PROJECT_REF || value.project_classification !== "staging_test_only") return stop("PROJECT_INVALID");
  if (value.authority !== "business_systems_v1.1_reconciliation_v0.2_and_s2_t159") return stop("AUTHORITY_INVALID");
  if (value.packet_sha256 !== EXPECTED_PACKET_SHA256) return stop("PACKET_DRIFT");
  if (value.transaction_mode !== "read_only_rolled_back" || value.migration_authorized !== false) return stop("READ_ONLY_BOUNDARY_INVALID");
  if (!Array.isArray(value.boundaries) || value.boundaries.length !== BOUNDARIES.length) return stop("BOUNDARIES_INVALID");
  for (let index = 0; index < BOUNDARIES.length; index += 1) {
    const entry = value.boundaries[index];
    if (!isRecord(entry) || !sameKeys(entry, BOUNDARY_KEYS) || entry.boundary_name !== BOUNDARIES[index]) return stop("BOUNDARIES_INVALID");
    for (const key of BOUNDARY_KEYS.slice(1)) {
      if (!Number.isSafeInteger(entry[key]) || entry[key] < 0) return stop("COUNT_INVALID");
    }
  }
  return { ok: true, status: "S2_T161_EVIDENCE_ACCEPTED", migrationAuthorized: false };
}

function isRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function sameKeys(value, keys) { return JSON.stringify(Object.keys(value)) === JSON.stringify(keys); }
function stop(suffix) { return { ok: false, code: `STOP_S2_T161_${suffix}` }; }
