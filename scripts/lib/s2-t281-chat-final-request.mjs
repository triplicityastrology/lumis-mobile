import assert from "node:assert/strict";

export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "chat-synthetic";
export const DICE_RUNTIME_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96";
export const DICE_RUNTIME_CONTROL_SHA256 = "b8d22c7c4677e654a83764f5499ddecb9bc97f327e115205ffd13848b5537be1";
export const DICE_RUNTIME_PROOF_SHA256 = "3f44ef8c674ae70037f1e34ffde9f0efb70862ee1bc4b158cadbeae50efe1256";
export const DICE_TECHNICAL_AUTHORITY = "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY";

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const NONCE = /^[a-f0-9]{32}$/;

export function exact(value, keys, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), code);
}

export function validateDiceEvidence(value, acceptedSha256) {
  exact(value, ["schema", "review_decision", "runtime_source_commit", "runtime_control_sha256", "runtime_proof_sha256", "technical_window_authority", "technical_evidence_package_sha256", "logical_total", "en", "zh_hant", "provider_disabled_verified", "founder_cases_run", "persistence_writes", "units_charged", "accepted_at"], "STOP_S2_T281_DICE_EVIDENCE_FIELDS");
  assert.equal(value.schema, "lumis_dice_technical_window_acceptance_v2");
  assert.equal(value.review_decision, "accepted");
  assert.equal(value.runtime_source_commit, DICE_RUNTIME_COMMIT);
  assert.equal(value.runtime_control_sha256, DICE_RUNTIME_CONTROL_SHA256);
  assert.equal(value.runtime_proof_sha256, DICE_RUNTIME_PROOF_SHA256);
  assert.equal(value.technical_window_authority, DICE_TECHNICAL_AUTHORITY);
  assert.match(value.technical_evidence_package_sha256, SHA);
  assert.deepEqual([value.logical_total, value.en, value.zh_hant], [80, 40, 40]);
  assert.equal(value.provider_disabled_verified, true);
  assert.equal(value.founder_cases_run, 0);
  assert.equal(value.persistence_writes, 0);
  assert.equal(value.units_charged, 0);
  assert.ok(Number.isFinite(Date.parse(value.accepted_at)));
  assert.match(acceptedSha256, SHA);
  return value;
}

function validateCommon(value, manifest, head, keys, schema, authority) {
  exact(value, keys, "STOP_S2_T281_AUTHORIZATION_FIELDS");
  assert.equal(value.schema, schema);
  assert.equal(value.authority, authority);
  assert.equal(value.project_ref, PROJECT_REF);
  assert.equal(value.review_package_sha256, manifest.package_binding_sha256);
  assert.equal(value.source_commit, head);
  assert.match(value.source_commit, COMMIT);
  assert.match(value.nonce, NONCE);
  const issued = Date.parse(value.issued_at);
  const expires = Date.parse(value.valid_until);
  assert.ok(Number.isFinite(issued) && Number.isFinite(expires) && issued <= Date.now() && expires > Date.now() && expires > issued);
}

export function validateDeploymentRequest(value, manifest, head) {
  const keys = ["schema", "authority", "project_ref", "function_name", "review_package_sha256", "source_commit", "provider_enabled", "provider_calls_allowed", "disabled_probe_count", "migration_0040_authorized", "traffic_authorized", "normal_chat_connected", "rollback_revision_sha256", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t281_chat_default_off_deployment_request_v1", "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY");
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.equal(value.provider_enabled, false);
  assert.equal(value.provider_calls_allowed, 0);
  assert.equal(value.disabled_probe_count, 4);
  assert.equal(value.migration_0040_authorized, false);
  assert.equal(value.traffic_authorized, false);
  assert.equal(value.normal_chat_connected, false);
  assert.match(value.rollback_revision_sha256, SHA);
  return value;
}

export function validateMigrationRequest(value, manifest, head) {
  const keys = ["schema", "authority", "project_ref", "migration_version", "migration_sha256", "review_package_sha256", "source_commit", "function_deployment_authorized", "traffic_authorized", "provider_calls_allowed", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t281_chat_migration_0040_request_v1", "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY");
  assert.equal(value.migration_version, "0040");
  assert.equal(value.migration_sha256, manifest.migration_0040_sha256);
  assert.equal(value.function_deployment_authorized, false);
  assert.equal(value.traffic_authorized, false);
  assert.equal(value.provider_calls_allowed, 0);
  return value;
}

export function validateTrafficRequest(value, manifest, head) {
  const keys = ["schema", "authority", "project_ref", "function_name", "review_package_sha256", "source_commit", "accepted_dice_evidence_sha256", "deployment_receipt_sha256", "migration_0040_receipt_sha256", "fixture_count", "language_counts", "runtime_request_fields", "normal_chat_connected", "member_data", "persistence_writes", "units_charged", "issued_at", "valid_until", "nonce"];
  validateCommon(value, manifest, head, keys, "s2_t281_chat_synthetic_traffic_request_v1", "CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY");
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.ok(manifest.accepted_dice_evidence_sha256 !== null, "STOP_S2_T281_DICE_EVIDENCE_NOT_COMPILED");
  assert.equal(value.accepted_dice_evidence_sha256, manifest.accepted_dice_evidence_sha256);
  assert.match(value.deployment_receipt_sha256, SHA);
  assert.match(value.migration_0040_receipt_sha256, SHA);
  assert.equal(value.fixture_count, 60);
  exact(value.language_counts, ["en", "zh_hant"], "STOP_S2_T281_LANGUAGE_COUNTS");
  assert.deepEqual(value.language_counts, { en: 30, zh_hant: 30 });
  assert.deepEqual(value.runtime_request_fields, ["fixture_id"]);
  assert.equal(value.normal_chat_connected, false);
  assert.equal(value.member_data, false);
  assert.equal(value.persistence_writes, 0);
  assert.equal(value.units_charged, 0);
  return value;
}
