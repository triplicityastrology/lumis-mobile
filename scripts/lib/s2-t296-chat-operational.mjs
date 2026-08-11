import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "chat-synthetic";
export const DICE_DEPLOYMENT_COMMIT = "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432";
export const DICE_RUNTIME_PACKAGE = "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457";
export const DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA = "lumis_dice_default_off_function_deployment_authorization_v4";
export const DICE_DEPLOYMENT_RECEIPT_SCHEMA = "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1";
export const DICE_TECHNICAL_COMMIT = "4b2c8c7578773b59b04d4e44ef4ca2dc57b7555f";
export const DICE_TECHNICAL_SCHEMA = "s2_t289_dice_technical_evidence_package_v1";
export const DICE_ACCEPTED_ENVELOPE_SCHEMA = "s2_t296_accepted_dice_v4_technical_evidence_v1";

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const NONCE = /^[a-f0-9]{32}$/;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function exact(value, keys, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), code);
}

export function loadJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

export function repositoryIdentity(root) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim();
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  assert.match(head, COMMIT);
  assert.match(tree, COMMIT);
  assert.equal(branch, "codex/s2-t296-chat-operational-packet");
  return { head, tree, branch };
}

export function validateDiceAcceptedEvidence(value, acceptedSha256) {
  exact(value, ["schema", "review_decision", "deployment_receipt", "technical_evidence", "accepted_at"], "STOP_S2_T296_DICE_EVIDENCE_FIELDS");
  exact(value.deployment_receipt, ["schema", "authorization_schema", "project_ref", "function_name", "deployment_id", "source_commit", "runtime_package_sha256", "disabled_probes", "provider_calls", "model_invocations", "kill_switch_disabled", "traffic_switch_disabled", "migration_applied", "deployed_at", "valid_until"], "STOP_S2_T296_DICE_DEPLOYMENT_FIELDS");
  exact(value.deployment_receipt.disabled_probes, ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"], "STOP_S2_T296_DICE_PROBES");
  exact(value.technical_evidence, ["schema", "run_id", "deployment_id", "runtime_package_sha256", "migration_proof_receipt_sha256", "registry_sha256", "technical_case_count", "founder_case_count", "language", "attempt_total", "concurrency_peak", "tokenizer", "cost_ceiling_usd", "provider_disabled_verified", "effects", "records"], "STOP_S2_T296_DICE_TECHNICAL_FIELDS");
  exact(value.technical_evidence.language, ["en", "zh-Hant"], "STOP_S2_T296_DICE_LANGUAGE_FIELDS");
  exact(value.technical_evidence.effects, ["provider_calls", "model_invocations", "persistence_writes", "units_charged", "finally_disabled", "post_window_disabled_proof_sha256"], "STOP_S2_T296_DICE_EFFECT_FIELDS");
  const deployment = value.deployment_receipt;
  const technical = value.technical_evidence;
  assert.equal(value.schema, DICE_ACCEPTED_ENVELOPE_SCHEMA);
  assert.equal(value.review_decision, "accepted");
  assert.equal(deployment.schema, DICE_DEPLOYMENT_RECEIPT_SCHEMA);
  assert.equal(deployment.authorization_schema, DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA);
  assert.deepEqual([deployment.project_ref, deployment.function_name, deployment.source_commit, deployment.runtime_package_sha256], [PROJECT_REF, "dice-synthetic", DICE_DEPLOYMENT_COMMIT, DICE_RUNTIME_PACKAGE]);
  assert.ok(Object.values(deployment.disabled_probes).every((code) => code === "DICE_AI_DISABLED"));
  assert.deepEqual([deployment.provider_calls, deployment.model_invocations, deployment.kill_switch_disabled, deployment.traffic_switch_disabled, deployment.migration_applied], [0, 0, true, true, false]);
  assert.equal(technical.schema, DICE_TECHNICAL_SCHEMA);
  assert.equal(technical.runtime_package_sha256, DICE_RUNTIME_PACKAGE);
  assert.equal(technical.deployment_id, deployment.deployment_id);
  assert.deepEqual([technical.technical_case_count, technical.founder_case_count, technical.language.en, technical.language["zh-Hant"]], [80, 0, 40, 40]);
  assert.ok(Number.isInteger(technical.attempt_total) && technical.attempt_total >= 0 && technical.attempt_total <= 160);
  assert.ok(Number.isInteger(technical.concurrency_peak) && technical.concurrency_peak >= 1 && technical.concurrency_peak <= 2);
  assert.deepEqual([technical.tokenizer, technical.cost_ceiling_usd, technical.provider_disabled_verified], ["js-tiktoken@1.0.21/o200k_base", 0.128, true]);
  assert.deepEqual([technical.effects.provider_calls, technical.effects.model_invocations, technical.effects.persistence_writes, technical.effects.units_charged, technical.effects.finally_disabled], [technical.attempt_total, technical.attempt_total, 0, 0, true]);
  assert.match(technical.effects.post_window_disabled_proof_sha256, SHA);
  assert.equal(technical.records.length, 80);
  assert.ok(Number.isFinite(Date.parse(value.accepted_at)));
  assert.match(acceptedSha256, SHA);
  return value;
}

function validateWindow(value, now, code) {
  assert.match(value.nonce, NONCE, code);
  const issued = Date.parse(value.issued_at);
  const expires = Date.parse(value.valid_until);
  assert.ok(Number.isFinite(issued) && Number.isFinite(expires), code);
  assert.ok(issued <= now && expires > now && expires > issued && expires - issued <= 15 * 60 * 1000, code);
}

function validateCommon(value, seal, identity, schema, scope, keys, now) {
  exact(value, keys, "STOP_S2_T296_AUTHORIZATION_FIELDS");
  assert.equal(value.schema, schema);
  assert.equal(value.authority_scope, scope);
  assert.equal(value.decision, "AUTHORIZED");
  assert.equal(value.project_ref, PROJECT_REF);
  assert.equal(value.review_package_sha256, seal.package_binding_sha256);
  assert.equal(value.source_commit, identity.head);
  assert.equal(value.source_tree, identity.tree);
  assert.equal(value.signature_algorithm, "Ed25519");
  assert.match(value.request_sha256, SHA);
  assert.match(value.microsoft_signature_base64, /^[A-Za-z0-9+/]{86}==$/);
  validateWindow(value, now, "STOP_S2_T296_AUTHORIZATION_WINDOW");
}

function requireCompiledAuthorization(value, seal, key) {
  const accepted = seal.compiled_authorities?.[key];
  assert.match(accepted, SHA, "STOP_S2_T296_AUTHORIZATION_NOT_COMPILED");
  assert.equal(sha256(canonicalJson(value)), accepted, "STOP_S2_T296_AUTHORIZATION_DIGEST_MISMATCH");
}

export function validateDeploymentAuthorization(value, seal, identity, now = Date.now()) {
  const keys = ["schema", "decision", "authority_scope", "project_ref", "function_name", "review_package_sha256", "source_commit", "source_tree", "provider_enabled", "provider_calls_allowed", "disabled_probe_count", "migration_0040_authorized", "traffic_authorized", "normal_chat_connected", "rollback_revision_sha256", "request_sha256", "issued_at", "valid_until", "nonce", "signature_algorithm", "microsoft_signature_base64"];
  validateCommon(value, seal, identity, "s2_t296_chat_default_off_deployment_authorization_v1", "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY", keys, now);
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.deepEqual([value.provider_enabled, value.provider_calls_allowed, value.disabled_probe_count], [false, 0, 4]);
  assert.deepEqual([value.migration_0040_authorized, value.traffic_authorized, value.normal_chat_connected], [false, false, false]);
  assert.match(value.rollback_revision_sha256, SHA);
  requireCompiledAuthorization(value, seal, "deployment_authorization_sha256");
  return value;
}

export function validateMigrationAuthorization(value, seal, identity, now = Date.now()) {
  const keys = ["schema", "decision", "authority_scope", "project_ref", "migration_version", "migration_sha256", "review_package_sha256", "source_commit", "source_tree", "function_deployment_authorized", "traffic_authorized", "provider_calls_allowed", "request_sha256", "issued_at", "valid_until", "nonce", "signature_algorithm", "microsoft_signature_base64"];
  validateCommon(value, seal, identity, "s2_t296_chat_migration_0040_authorization_v1", "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY", keys, now);
  assert.equal(value.migration_version, "0040");
  assert.equal(value.migration_sha256, seal.migration_0040_sha256);
  assert.deepEqual([value.function_deployment_authorized, value.traffic_authorized, value.provider_calls_allowed], [false, false, 0]);
  requireCompiledAuthorization(value, seal, "migration_0040_authorization_sha256");
  return value;
}

export function validateTrafficAuthorization(value, seal, identity, now = Date.now()) {
  const keys = ["schema", "decision", "authority_scope", "project_ref", "function_name", "review_package_sha256", "source_commit", "source_tree", "accepted_dice_evidence_sha256", "deployment_receipt_sha256", "migration_0040_receipt_sha256", "fixture_registry_sha256", "fixture_count", "language_counts", "attempt_cap", "input_token_cap", "output_token_cap", "concurrency", "eligible_retries", "shared_deadline_ms", "runtime_request_fields", "normal_chat_connected", "member_context", "threads", "messages", "persistence_writes", "units_charged", "request_sha256", "issued_at", "valid_until", "nonce", "signature_algorithm", "microsoft_signature_base64"];
  validateCommon(value, seal, identity, "s2_t296_chat_synthetic_traffic_authorization_v1", "CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY", keys, now);
  assert.equal(value.function_name, FUNCTION_NAME);
  assert.ok(seal.accepted_dice_evidence_sha256 !== null, "STOP_S2_T296_DICE_EVIDENCE_NOT_COMPILED");
  assert.equal(value.accepted_dice_evidence_sha256, seal.accepted_dice_evidence_sha256);
  for (const digest of [value.deployment_receipt_sha256, value.migration_0040_receipt_sha256, value.fixture_registry_sha256]) assert.match(digest, SHA);
  assert.deepEqual([value.fixture_count, value.language_counts, value.attempt_cap, value.input_token_cap, value.output_token_cap, value.concurrency, value.eligible_retries, value.shared_deadline_ms], [60, { en: 30, zh_hant: 30 }, 120, 1200, 300, 1, 1, 12000]);
  assert.deepEqual(value.runtime_request_fields, ["fixture_id"]);
  assert.deepEqual([value.normal_chat_connected, value.member_context, value.threads, value.messages, value.persistence_writes, value.units_charged], [false, false, false, false, 0, 0]);
  requireCompiledAuthorization(value, seal, "traffic_authorization_sha256");
  return value;
}
