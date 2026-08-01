import { readFileSync, readdirSync } from "node:fs";

const APPROVED_REF = "bmqhwofmdgebpcihjlnb";
const EXPECTED_PENDING = ["0032", "0033", "0034"];
const FORBIDDEN_KEY =
  /(?:secret|password|token|pairing|fingerprint|email|user_?id|row|payload|body|url|connection|credential)/i;
const ALLOWED_KEYS = new Set([
  "schema_version", "project_ref", "backup", "captured_at",
  "destruction_deadline", "restore_validated", "legacy_counts",
  "legacy_revoked_relationship_count", "legacy_code_fingerprint_count",
  "legacy_code_non_sha256_shape_count", "legacy_notification_count",
  "legacy_notification_with_body_count", "history_columns", "column_name",
  "data_type", "udt_name", "is_nullable", "column_default",
  "ordinal_position", "remote_migration_versions", "pending_migration_versions",
  "rollback_rehearsal", "status", "persisted_change_count"
]);

class EvidenceStop extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

try {
  const file = process.argv[2];
  stopIf(!file || process.argv.length !== 3, "INPUT_REQUIRED");
  const evidence = JSON.parse(readFileSync(file, "utf8"));
  validateClosedEvidence(evidence);
  process.stdout.write("S2_T45_DASHBOARD_EVIDENCE_PASS\n");
} catch (error) {
  const code =
    error instanceof EvidenceStop ? error.code : "INPUT_INVALID";
  process.stderr.write(`STOP_S2_T45_${code}\n`);
  process.exitCode = 1;
}

function validateClosedEvidence(value) {
  stopIf(!isRecord(value), "INPUT_INVALID");
  rejectForbiddenKeys(value);
  exactKeys(value, [
    "schema_version",
    "project_ref",
    "backup",
    "legacy_counts",
    "history_columns",
    "remote_migration_versions",
    "pending_migration_versions",
    "rollback_rehearsal"
  ]);
  stopIf(value.schema_version !== 1, "SCHEMA_VERSION_INVALID");
  stopIf(value.project_ref !== APPROVED_REF, "PROJECT_REF_MISMATCH");

  exactKeys(value.backup, [
    "captured_at",
    "destruction_deadline",
    "restore_validated"
  ]);
  const capturedAt = parseTimestamp(value.backup.captured_at);
  const deadline = parseTimestamp(value.backup.destruction_deadline);
  stopIf(value.backup.restore_validated !== true, "BACKUP_RESTORE_UNVERIFIED");
  stopIf(deadline <= capturedAt, "BACKUP_DEADLINE_INVALID");
  stopIf(deadline - capturedAt > 7 * 24 * 60 * 60 * 1000, "BACKUP_RETENTION_EXCEEDED");

  exactKeys(value.legacy_counts, [
    "legacy_revoked_relationship_count",
    "legacy_code_fingerprint_count",
    "legacy_code_non_sha256_shape_count",
    "legacy_notification_count",
    "legacy_notification_with_body_count"
  ]);
  for (const count of Object.values(value.legacy_counts)) {
    stopIf(!Number.isSafeInteger(count) || count < 0, "LEGACY_COUNT_INVALID");
  }
  stopIf(
    value.legacy_counts.legacy_revoked_relationship_count !== 0,
    "LEGACY_REVOKED_ROWS_PRESENT"
  );
  stopIf(
    value.legacy_counts.legacy_code_non_sha256_shape_count !== 0,
    "LEGACY_FINGERPRINT_INVALID"
  );
  stopIf(
    value.legacy_counts.legacy_notification_with_body_count !== 0,
    "LEGACY_NOTIFICATION_BODY_PRESENT"
  );
  stopIf(
    value.legacy_counts.legacy_code_non_sha256_shape_count >
      value.legacy_counts.legacy_code_fingerprint_count ||
      value.legacy_counts.legacy_notification_with_body_count >
        value.legacy_counts.legacy_notification_count,
    "LEGACY_COUNT_RELATION_INVALID"
  );

  stopIf(!Array.isArray(value.history_columns), "HISTORY_SHAPE_INVALID");
  const columnNames = value.history_columns.map((column) => {
    exactKeys(column, [
      "column_name",
      "data_type",
      "udt_name",
      "is_nullable",
      "column_default",
      "ordinal_position"
    ]);
    stopIf(
      typeof column.column_name !== "string" ||
        typeof column.data_type !== "string" ||
        typeof column.udt_name !== "string" ||
        !["YES", "NO"].includes(column.is_nullable) ||
        !(column.column_default === null || typeof column.column_default === "string") ||
        !Number.isSafeInteger(column.ordinal_position) ||
        !/^[a-z][a-z0-9_]*$/u.test(column.column_name),
      "HISTORY_SHAPE_INVALID"
    );
    return column.column_name;
  });
  stopIf(
    columnNames.length === 0 ||
      columnNames.length > 8 ||
      new Set(columnNames).size !== columnNames.length ||
      !columnNames.includes("version") ||
      value.history_columns.some(
        (column, index) => column.ordinal_position !== index + 1
      ),
    "HISTORY_SHAPE_INVALID"
  );

  const expectedRemote = localMigrationVersions().filter(
    (version) => Number(version) < 32
  );
  exactStringArray(value.remote_migration_versions, "REMOTE_PARITY_INVALID");
  stopIf(
    JSON.stringify(value.remote_migration_versions) !== JSON.stringify(expectedRemote),
    "REMOTE_PARITY_INVALID"
  );
  exactStringArray(value.pending_migration_versions, "PENDING_ORDER_INVALID");
  stopIf(
    JSON.stringify(value.pending_migration_versions) !== JSON.stringify(EXPECTED_PENDING),
    "PENDING_ORDER_INVALID"
  );

  exactKeys(value.rollback_rehearsal, ["status", "persisted_change_count"]);
  stopIf(
    value.rollback_rehearsal.status !== "passed_no_persisted_changes" ||
      value.rollback_rehearsal.persisted_change_count !== 0,
    "ROLLBACK_REHEARSAL_UNVERIFIED"
  );
}

function localMigrationVersions() {
  return readdirSync("supabase/migrations")
    .map((name) => name.match(/^(\d{4})_/u)?.[1])
    .filter(Boolean)
    .sort();
}

function exactStringArray(value, code) {
  stopIf(
    !Array.isArray(value) || value.some((entry) => !/^\d{4}$/u.test(entry)),
    code
  );
}

function rejectForbiddenKeys(value) {
  if (Array.isArray(value)) {
    value.forEach(rejectForbiddenKeys);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    stopIf(FORBIDDEN_KEY.test(key) && !ALLOWED_KEYS.has(key), "FORBIDDEN_FIELD");
    rejectForbiddenKeys(child);
  }
}

function exactKeys(value, expected) {
  stopIf(!isRecord(value), "FIELD_SHAPE_INVALID");
  const actual = Object.keys(value).sort();
  stopIf(
    JSON.stringify(actual) !== JSON.stringify([...expected].sort()),
    "FIELD_SHAPE_INVALID"
  );
}

function parseTimestamp(value) {
  stopIf(typeof value !== "string", "BACKUP_TIMESTAMP_INVALID");
  const parsed = Date.parse(value);
  stopIf(!Number.isFinite(parsed) || !value.endsWith("Z"), "BACKUP_TIMESTAMP_INVALID");
  return parsed;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stopIf(condition, code) {
  if (condition) throw new EvidenceStop(code);
}
