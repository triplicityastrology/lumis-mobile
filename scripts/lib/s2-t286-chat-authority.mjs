import assert from "node:assert/strict";

export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "chat-synthetic";
export const DICE_ACCEPTANCE_SCHEMA = "s2_t284_dice_technical_evidence_acceptance_v1";
export const DICE_DEPLOYMENT_SCHEMA = "s2_t282_dice_default_off_deployment_receipt_v1";
export const DICE_TECHNICAL_AUTHORITY = "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY";

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const NONCE = /^[a-f0-9]{32}$/;

export function exact(value, keys, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), code);
}

export function validateDiceEvidence(value, acceptedSha256) {
  exact(value, ["schema", "review_decision", "deployment_receipt", "technical_window", "accepted_at"], "STOP_S2_T286_DICE_EVIDENCE_FIELDS");
  exact(value.deployment_receipt, ["schema", "source_commit", "runtime_package_sha256", "disabled_probes", "provider_calls", "model_invocations", "migration_applied"], "STOP_S2_T286_DICE_DEPLOYMENT_FIELDS");
  exact(value.technical_window, ["authority", "evidence_package_sha256", "logical_total", "en", "zh_hant", "attempt_total", "max_attempts", "provider_disabled_verified", "founder_cases_run", "persistence_writes", "units_charged"], "STOP_S2_T286_DICE_TECHNICAL_FIELDS");
  const deployment = value.deployment_receipt;
  const technical = value.technical_window;
  assert.equal(value.schema, DICE_ACCEPTANCE_SCHEMA);
  assert.equal(value.review_decision, "accepted");
  assert.equal(deployment.schema, DICE_DEPLOYMENT_SCHEMA);
  assert.match(deployment.source_commit, COMMIT);
  assert.doesNotMatch(deployment.source_commit, /^0+$/);
  assert.match(deployment.runtime_package_sha256, SHA);
  assert.deepEqual(deployment.disabled_probes, Array(4).fill("DICE_AI_DISABLED"));
  assert.deepEqual([deployment.provider_calls, deployment.model_invocations, deployment.migration_applied], [0, 0, false]);
  assert.equal(technical.authority, DICE_TECHNICAL_AUTHORITY);
  assert.match(technical.evidence_package_sha256, SHA);
  assert.deepEqual([technical.logical_total, technical.en, technical.zh_hant, technical.max_attempts], [80, 40, 40, 160]);
  assert.ok(Number.isInteger(technical.attempt_total) && technical.attempt_total >= 0 && technical.attempt_total <= 160);
  assert.deepEqual([technical.provider_disabled_verified, technical.founder_cases_run, technical.persistence_writes, technical.units_charged], [true, 0, 0, 0]);
  assert.ok(Number.isFinite(Date.parse(value.accepted_at)));
  assert.match(acceptedSha256, SHA);
  return value;
}

function validateCommon(value, manifest, head, keys, schema, authority, now = Date.now()) {
  exact(value, keys, "STOP_S2_T286_AUTHORIZATION_FIELDS");
  assert.equal(value.schema, schema);
  assert.equal(value.authority, authority);
  assert.equal(value.project_ref, PROJECT_REF);
  assert.equal(value.review_package_sha256, manifest.package_binding_sha256);
  assert.equal(value.source_commit, head);
  assert.match(value.source_commit, COMMIT);
  assert.match(value.nonce, NONCE);
  const issued = Date.parse(value.issued_at);
  const expires = Date.parse(value.valid_until);
  assert.ok(Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && expires > now && expires > issued);
}

export function validateDeploymentRequest(value, manifest, head, now) {
  const keys = ["schema", "authority", "project_ref", "function_name", "review_package_sha256", "source_commit", "provider_enabled", "provider_calls_allowed", "disabled_probe_count", "migration_0040_authorized", "traffic_authorized", "normal_chat_connected", "rollback_revision_sha256", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t286_chat_default_off_deployment_request_v1", "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY", now);
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.deepEqual([value.provider_enabled, value.provider_calls_allowed, value.disabled_probe_count], [false, 0, 4]);
  assert.deepEqual([value.migration_0040_authorized, value.traffic_authorized, value.normal_chat_connected], [false, false, false]);
  assert.match(value.rollback_revision_sha256, SHA);
  return value;
}

export function validateTrafficRequest(value, manifest, head, now) {
  const keys = ["schema", "authority", "project_ref", "function_name", "review_package_sha256", "source_commit", "accepted_dice_evidence_sha256", "deployment_receipt_sha256", "migration_0040_receipt_sha256", "fixture_count", "language_counts", "runtime_request_fields", "normal_chat_connected", "member_context", "threads", "messages", "persistence_writes", "units_charged", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t286_chat_synthetic_traffic_request_v1", "CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY", now);
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.ok(manifest.accepted_dice_evidence_sha256 !== null, "STOP_S2_T286_DICE_EVIDENCE_NOT_COMPILED");
  assert.equal(value.accepted_dice_evidence_sha256, manifest.accepted_dice_evidence_sha256);
  assert.match(value.deployment_receipt_sha256, SHA);
  assert.match(value.migration_0040_receipt_sha256, SHA);
  assert.equal(value.fixture_count, 60);
  exact(value.language_counts, ["en", "zh_hant"], "STOP_S2_T286_LANGUAGE_COUNTS");
  assert.deepEqual(value.language_counts, { en: 30, zh_hant: 30 });
  assert.deepEqual(value.runtime_request_fields, ["fixture_id"]);
  assert.deepEqual([value.normal_chat_connected, value.member_context, value.threads, value.messages, value.persistence_writes, value.units_charged], [false, false, false, false, 0, 0]);
  return value;
}

export function validateMigrationRequest(value, manifest, head, now) {
  const keys = ["schema", "authority", "project_ref", "migration_version", "migration_sha256", "review_package_sha256", "source_commit", "function_deployment_authorized", "traffic_authorized", "provider_calls_allowed", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t286_chat_migration_0040_request_v1", "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY", now);
  assert.equal(value.migration_version, "0040");
  assert.equal(value.migration_sha256, manifest.migration_0040_sha256);
  assert.deepEqual([value.function_deployment_authorized, value.traffic_authorized, value.provider_calls_allowed], [false, false, 0]);
  return value;
}
