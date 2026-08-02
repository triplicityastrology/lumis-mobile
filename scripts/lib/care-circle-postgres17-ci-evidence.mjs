import { createHash } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const CI_RECEIPT_PATH = ".lumis-local/s2-t162-care-circle-postgres17-ci-receipt.json";
const SOURCE_COMMIT = "07b18e530158a6dab260d6f447680cb3ef0f4720";
const WORKFLOW_SHA256 = "8e5c1309163dbbc0c4e811dfd05a18efca72205494ac99c012b9bbf808762349";
const MIGRATIONS = [
  ["0032", "9d5dfdeab0975c9c8d923495bd5a17fa26ea5c26ef05ba4f036ac506b087a79e"],
  ["0033", "0996ecd9fcf6e4fb2b083d980e69a0c2dd042107bc8e753fdd43f79d0bcb0a1d"],
  ["0034", "466821a3a92a1f75543cf265d2d2c4e3dcb3f850ee79efd77df3269cd4797ceb"],
  ["0037", "3a5deda8546d5255e51c0cece16e67687cd71a63743f923a49aebf94f2f5852c"],
];
const ROOT_KEYS = ["schema", "status", "workflow_source_commit", "workflow_path", "workflow_sha256", "runner", "postgres_version", "postgres_image", "migrations", "assertions", "network_calls", "remote_data_used"];
const ASSERTION_KEYS = ["migration_order_passed", "expiry_passed", "active_code_uniqueness_passed", "hash_only_persistence_passed", "replay_conflict_passed", "generic_failure_passed", "concurrent_throttle_passed", "rollback_passed", "cleanup_confirmed"];

export function validatePostgres17CiEvidence(value) {
  if (!isRecord(value) || !sameKeys(value, ROOT_KEYS)) return stop("SCHEMA_INVALID");
  if (value.schema !== "s2_t162_care_circle_postgres17_ci_evidence_v1" || value.status !== "CI_PROOF_PASSED") return stop("STATUS_INVALID");
  if (value.workflow_source_commit !== SOURCE_COMMIT || value.workflow_path !== ".github/workflows/s2-t157-care-circle-postgres17-proof.yml" || value.workflow_sha256 !== WORKFLOW_SHA256) return stop("WORKFLOW_DRIFT");
  if (value.runner !== "ubuntu-24.04" || value.postgres_version !== "17.6" || value.postgres_image !== "public.ecr.aws/supabase/postgres:17.6.1.143") return stop("RUNTIME_INVALID");
  if (!Array.isArray(value.migrations) || value.migrations.length !== MIGRATIONS.length) return stop("MIGRATION_EVIDENCE_INVALID");
  for (let index = 0; index < MIGRATIONS.length; index += 1) {
    const entry = value.migrations[index];
    if (!isRecord(entry) || !sameKeys(entry, ["version", "sha256"]) || entry.version !== MIGRATIONS[index][0] || entry.sha256 !== MIGRATIONS[index][1]) return stop("MIGRATION_EVIDENCE_INVALID");
  }
  if (!isRecord(value.assertions) || !sameKeys(value.assertions, ASSERTION_KEYS) || !ASSERTION_KEYS.every((key) => value.assertions[key] === true)) return stop("PROOF_INCOMPLETE");
  if (value.network_calls !== 0 || value.remote_data_used !== false) return stop("REMOTE_BOUNDARY_INVALID");
  if (containsUnsafeEvidence(value)) return stop("UNSAFE_EVIDENCE");
  return { ok: true, evidenceSha256: sha(JSON.stringify(value)) };
}

export function writePostgres17CiReceipt(evidence, receiptPath = CI_RECEIPT_PATH) {
  const validated = validatePostgres17CiEvidence(evidence);
  if (!validated.ok) return validated;
  const receipt = {
    schema: "s2_t162_care_circle_postgres17_ci_receipt_v1",
    status: "database_proof_recorded",
    workflow_source_commit: SOURCE_COMMIT,
    evidence_sha256: validated.evidenceSha256,
    staging_ready: false,
    remote_writes_authorized: false,
  };
  const canonical = path.resolve(receiptPath);
  const allowed = path.resolve(CI_RECEIPT_PATH);
  if (canonical !== allowed) return stop("RECEIPT_PATH_INVALID");
  mkdirSync(path.dirname(canonical), { recursive: true, mode: 0o700 });
  const temporary = `${canonical}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, canonical);
  return { ok: true, receipt };
}

function containsUnsafeEvidence(value) {
  const serialized = JSON.stringify(value);
  return /https?:\/\/|postgres(?:ql)?:\/\/|database_host|row_data|logs?|secret|credential|token|email|user_id|request_body|response_body/iu.test(serialized);
}
function isRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function sameKeys(value, keys) { return JSON.stringify(Object.keys(value)) === JSON.stringify(keys); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stop(suffix) { return { ok: false, code: `STOP_S2_T162_${suffix}` }; }

