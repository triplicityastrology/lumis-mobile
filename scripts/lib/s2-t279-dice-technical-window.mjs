import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const STOP = Object.freeze({
  deployment: "WAITING_FOR_ACCEPTED_DICE_DEFAULT_OFF_DEPLOYMENT_RECEIPT",
  migration: "WAITING_FOR_ACCEPTED_DICE_0039_MIGRATION_RECEIPT",
  traffic: "WAITING_FOR_MICROSOFT_DICE_TECHNICAL_TRAFFIC_AUTHORITY",
  source: "STOP_S2_T279_SEALED_SOURCE_DRIFT",
  registry: "STOP_S2_T279_TECHNICAL_REGISTRY_INVALID",
  authority: "STOP_S2_T279_AUTHORITY_INVALID",
  replay: "STOP_S2_T279_RUN_AUTHORITY_REPLAYED",
  attempts: "STOP_S2_T279_ATTEMPT_CAP",
  tokens: "STOP_S2_T279_TOKEN_CAP",
  concurrency: "STOP_S2_T279_CONCURRENCY_CAP",
  deadline: "STOP_S2_T279_CASE_DEADLINE",
  unsafe: "STOP_S2_T279_UNSAFE_EVIDENCE",
  provider: "STOP_S2_T279_PROVIDER_KILL_CRITERION",
  disable: "STOP_S2_T279_POST_WINDOW_DISABLE_FAILED",
  evidence: "STOP_S2_T279_EVIDENCE_INVALID",
});

export class TechnicalWindowStop extends Error {
  constructor(code) { super(code); this.name = "TechnicalWindowStop"; this.code = code; }
}

const SHA = /^[a-f0-9]{64}$/;
const RUN = /^dice-tech80-[a-z0-9]{16,40}$/;
const FIXTURE = /^DICE-TECH-(EN|ZH)-[A-Z0-9-]+-[0-9]{2}$/;
const RESULTS = new Set(["completed", "safety", "excluded", "fallback", "technical_error"]);
const FAILURES = new Set(["none", "safety_block", "scope_excluded", "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_malformed", "defaultv2_block", "defaultv2_partial", "input_token_cap", "output_token_cap"]);
const RETRYABLE = new Set(["provider_timeout", "provider_rate_limited", "provider_unavailable"]);
const FORBIDDEN_EVIDENCE_KEYS = new Set(["prompt", "response", "question", "member_id", "account_id", "device_id", "endpoint", "api_key", "secret", "raw_error"]);

const stop = (code) => { throw new TechnicalWindowStop(code); };
const exact = (value, keys, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) stop(code);
};
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const fileSha256 = (path) => sha256(readFileSync(path));

export function loadAndValidateControl(root = process.cwd()) {
  const control = JSON.parse(readFileSync(`${root}/config/s2-t279-dice-technical-window-final.json`, "utf8"));
  const release = JSON.parse(readFileSync(`${root}/${control.release_manifest}`, "utf8"));
  const registry = JSON.parse(readFileSync(`${root}/${control.registry_file}`, "utf8"));
  if (control.runtime_commit !== "f5f9e9da238633d84eb8695307c573eef8f1bc96" ||
      control.gateway_package_sha256 !== "3ccc7551fd945b4ca4c3aaeaa7b8f9efd61f29b56e8ebe3c69ea9f5c5aaae8ba" ||
      control.runtime_package_sha256 !== "f47b7a825dda6ee2a9fba0e269a8e1f7d1f94e96732a9445fa32e6a6fa9c98a5" ||
      control.ledger_proof.commit !== "5db1b0e34e5c3e34933e8c68f8481e192bcc62ce" ||
      control.ledger_proof.receipt_sha256 !== "4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e" ||
      fileSha256(`${root}/${control.ledger_proof.receipt_file}`) !== control.ledger_proof.receipt_sha256 ||
      release.package_sha256 !== control.gateway_package_sha256 || release.registry_sha256 !== control.registry_sha256 ||
      fileSha256(`${root}/${control.registry_file}`) !== control.registry_file_sha256 ||
      registry.schema !== "lumis_dice_technical_registry_v1" || registry.fixtures?.length !== 80) stop(STOP.source);
  validateRegistry(registry.fixtures);
  const price = JSON.parse(readFileSync(`${root}/${control.pricing.evidence_file}`, "utf8"));
  const calculated = 160 * ((800 * price.input_price_usd_per_1m_tokens + 300 * price.output_price_usd_per_1m_tokens) / 1_000_000);
  if (price.currency !== "USD" || price.input_price_usd_per_1m_tokens !== 0.25 || price.output_price_usd_per_1m_tokens !== 2 ||
      Number(calculated.toFixed(3)) !== control.limits.technical_cost_ceiling_usd) stop(STOP.source);
  return Object.freeze({ control, release, registry });
}

export function validateRegistry(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length !== 80) stop(STOP.registry);
  const seen = new Set();
  const languages = { en: 0, "zh-Hant": 0 };
  for (const fixture of fixtures) {
    exact(fixture, ["fixture_id", "language", "phase"], STOP.registry);
    if (!FIXTURE.test(fixture.fixture_id) || fixture.phase !== "technical" || !Object.hasOwn(languages, fixture.language) || seen.has(fixture.fixture_id) || /FOUNDER/i.test(fixture.fixture_id)) stop(STOP.registry);
    seen.add(fixture.fixture_id); languages[fixture.language] += 1;
  }
  if (languages.en !== 40 || languages["zh-Hant"] !== 40) stop(STOP.registry);
  return fixtures;
}

export function validateDeploymentReceipt(value, control, now = Date.now()) {
  exact(value, ["schema", "project_ref", "function_name", "deployment_id", "runtime_commit", "runtime_package_sha256", "gateway_package_sha256", "provider_calls", "model_invocations", "disabled_verified", "issued_at", "expires_at"], STOP.deployment);
  const issued = Date.parse(value.issued_at), expires = Date.parse(value.expires_at);
  if (value.schema !== "s2_t279_accepted_default_off_deployment_receipt_v1" || value.project_ref !== "bmqhwofmdgebpcihjlnb" ||
      value.function_name !== "dice-synthetic" || !/^dice-deploy-[a-z0-9]{16,40}$/.test(value.deployment_id) ||
      value.runtime_commit !== control.runtime_commit || value.runtime_package_sha256 !== control.runtime_package_sha256 ||
      value.gateway_package_sha256 !== control.gateway_package_sha256 || value.provider_calls !== 0 || value.model_invocations !== 0 ||
      value.disabled_verified !== true || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now) stop(STOP.deployment);
  return value;
}

export function validateMigrationReceipt(value, control, now = Date.now()) {
  exact(value, ["schema", "project_ref", "migration_version", "migration_name", "migration_sha256", "ledger_contract_commit", "local_proof_schema_sha256", "local_proof_receipt_sha256", "applied", "parity_verified", "rpc_rls_verified", "metadata_only_verified", "provider_calls", "issued_at", "expires_at"], STOP.migration);
  const issued = Date.parse(value.issued_at), expires = Date.parse(value.expires_at);
  if (value.schema !== "s2_t279_accepted_dice_0039_migration_receipt_v1" || value.project_ref !== "bmqhwofmdgebpcihjlnb" ||
      value.migration_version !== "0039" || value.migration_name !== "dice_synthetic_authority_ledger" ||
      value.migration_sha256 !== control.ledger_proof.migration_sha256 || value.ledger_contract_commit !== control.ledger_proof.commit ||
      value.local_proof_schema_sha256 !== control.ledger_proof.schema_sha256 || value.local_proof_receipt_sha256 !== control.ledger_proof.receipt_sha256 ||
      value.applied !== true || value.parity_verified !== true || value.rpc_rls_verified !== true || value.metadata_only_verified !== true || value.provider_calls !== 0 ||
      !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now) stop(STOP.migration);
  return value;
}

export function validateTrafficAuthority(value, control, deployment, migration, now = Date.now()) {
  exact(value, ["schema", "authorization_scope", "single_use_run_id", "deployment_id", "migration_version", "runtime_commit", "runtime_package_sha256", "gateway_package_sha256", "ledger_proof_receipt_sha256", "technical_cases", "language", "founder_cases", "attempt_cap", "concurrency", "eligible_retries", "shared_deadline_ms", "cost_ceiling_usd", "issued_at", "valid_until", "microsoft_review", "gateway_authorization"], STOP.traffic);
  const issued = Date.parse(value.issued_at), expires = Date.parse(value.valid_until);
  if (value.schema !== "s2_t279_dice_technical_traffic_authorization_v1" || value.authorization_scope !== "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" || !RUN.test(value.single_use_run_id) ||
      value.deployment_id !== deployment.deployment_id || value.migration_version !== migration.migration_version ||
      value.runtime_commit !== control.runtime_commit || value.runtime_package_sha256 !== control.runtime_package_sha256 || value.gateway_package_sha256 !== control.gateway_package_sha256 ||
      value.ledger_proof_receipt_sha256 !== control.ledger_proof.receipt_sha256 || value.technical_cases !== 80 || value.language?.en !== 40 || value.language?.["zh-Hant"] !== 40 ||
      value.founder_cases !== 0 || value.attempt_cap !== 160 || value.concurrency !== 2 || value.eligible_retries !== 1 || value.shared_deadline_ms !== 12000 || value.cost_ceiling_usd !== 0.128 ||
      value.microsoft_review !== "accepted" || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now) stop(STOP.traffic);
  exact(value.gateway_authorization, ["schema", "interface_version", "authorization_scope", "single_use_run_id", "issued_at", "valid_until", "gateway_package_sha256", "fixture_registry_sha256", "technical_case_count", "founder_execution", "authorization_hmac_sha256"], STOP.traffic);
  const gateway = value.gateway_authorization;
  if (gateway.schema !== "lumis_dice_default_off_deployment_authorization_v2" || gateway.interface_version !== "dice_synthetic_gateway_port_v1" ||
      gateway.authorization_scope !== "technical_80_only" || gateway.single_use_run_id !== value.single_use_run_id || gateway.issued_at !== value.issued_at || gateway.valid_until !== value.valid_until ||
      gateway.gateway_package_sha256 !== control.gateway_package_sha256 || gateway.fixture_registry_sha256 !== control.registry_sha256 ||
      gateway.technical_case_count !== 80 || gateway.founder_execution !== false || typeof gateway.authorization_hmac_sha256 !== "string" || !SHA.test(gateway.authorization_hmac_sha256)) stop(STOP.traffic);
  return value;
}

export function validateProviderEvidence(value, fixture, runId) {
  const keys = ["schema", "run_id", "fixture_id", "phase", "language", "result_class", "attempt_count", "input_tokens", "output_tokens", "duration_ms", "concurrency_peak", "redacted_failure_code", "observed_at", "retain_until", "effects"];
  exact(value, keys, STOP.unsafe);
  for (const forbidden of FORBIDDEN_EVIDENCE_KEYS) if (JSON.stringify(value).toLowerCase().includes(forbidden)) stop(STOP.unsafe);
  exact(value.effects, ["normal_routes", "units_charged", "persistence_writes"], STOP.unsafe);
  if (value.schema !== "lumis_dice_synthetic_metadata_evidence_v1" || value.run_id !== runId || value.fixture_id !== fixture.fixture_id || value.phase !== "technical" || value.language !== fixture.language ||
      !RESULTS.has(value.result_class) || !FAILURES.has(value.redacted_failure_code) || !Number.isInteger(value.attempt_count) || value.attempt_count < 0 || value.attempt_count > 2 ||
      !Number.isInteger(value.input_tokens) || value.input_tokens < 0 || value.input_tokens > 800 || !Number.isInteger(value.output_tokens) || value.output_tokens < 0 || value.output_tokens > 300 ||
      !Number.isFinite(value.duration_ms) || value.duration_ms < 0 || value.duration_ms > 12000 || !Number.isInteger(value.concurrency_peak) || value.concurrency_peak < 0 || value.concurrency_peak > 2 ||
      value.effects.normal_routes !== 0 || value.effects.units_charged !== 0 || value.effects.persistence_writes !== 0) stop(STOP.unsafe);
  const observed = Date.parse(value.observed_at), retained = Date.parse(value.retain_until);
  if (!Number.isFinite(observed) || !Number.isFinite(retained) || retained - observed !== 30 * 86_400_000) stop(STOP.unsafe);
  if (value.attempt_count === 2 && !RETRYABLE.has(value.redacted_failure_code) && value.result_class !== "completed") stop(STOP.provider);
  if (["provider_authentication", "provider_permission"].includes(value.redacted_failure_code)) stop(STOP.provider);
  return Object.freeze(structuredClone(value));
}

export async function runTechnicalWindow({ gateway, deploymentReceipt, migrationReceipt, trafficAuthority, root = process.cwd(), claimRun = async () => true, onRecord = async () => {} }) {
  const { control, registry } = loadAndValidateControl(root);
  const deployment = validateDeploymentReceipt(deploymentReceipt, control);
  const migration = validateMigrationReceipt(migrationReceipt, control);
  const authority = validateTrafficAuthority(trafficAuthority, control, deployment, migration);
  if (!gateway || !["status", "executeAuthorizedWindow"].every((key) => typeof gateway[key] === "function")) stop(STOP.source);
  const pre = await gateway.status();
  if (!isDisabledStatus(pre)) stop(STOP.deployment);
  if (await claimRun(authority.single_use_run_id) !== true) stop(STOP.replay);
  let rawPackage, originalError;
  try {
    rawPackage = await gateway.executeAuthorizedWindow(authority.gateway_authorization);
  } catch (error) { originalError = error; }
  finally {
    const post = await gateway.status().catch(() => null);
    if (!isDisabledStatus(post)) throw new TechnicalWindowStop(STOP.disable);
  }
  if (originalError) throw originalError;
  exact(rawPackage, ["schema", "run_id", "technical_case_count", "founder_case_count", "attempt_total", "tokenizer_vocabulary", "provider_disabled_verified", "records"], STOP.evidence);
  if (rawPackage.schema !== "lumis_dice_synthetic_metadata_evidence_package_v1" || rawPackage.run_id !== authority.single_use_run_id || rawPackage.technical_case_count !== 80 ||
      rawPackage.founder_case_count !== 0 || rawPackage.tokenizer_vocabulary !== "o200k_base" || rawPackage.provider_disabled_verified !== true || !Array.isArray(rawPackage.records) || rawPackage.records.length !== 80) stop(STOP.evidence);
  const records = [];
  let attempts = 0, peak = 0;
  for (let index = 0; index < registry.fixtures.length; index += 1) {
    const result = validateProviderEvidence(rawPackage.records[index], registry.fixtures[index], authority.single_use_run_id);
    attempts += result.attempt_count; peak = Math.max(peak, result.concurrency_peak); records.push(result); await onRecord(result);
  }
  if (attempts !== rawPackage.attempt_total || attempts > 160 || peak > 2) stop(attempts > 160 ? STOP.attempts : STOP.evidence);
  const language = records.reduce((out, record) => ({ ...out, [record.language]: out[record.language] + 1 }), { en: 0, "zh-Hant": 0 });
  if (language.en !== 40 || language["zh-Hant"] !== 40) stop(STOP.evidence);
  return Object.freeze({
    schema: "s2_t279_dice_technical_evidence_package_v1",
    run_id: authority.single_use_run_id,
    runtime_commit: control.runtime_commit,
    runtime_package_sha256: control.runtime_package_sha256,
    gateway_package_sha256: control.gateway_package_sha256,
    ledger_proof_receipt_sha256: control.ledger_proof.receipt_sha256,
    technical_case_count: 80,
    founder_case_count: 0,
    language,
    attempt_total: attempts,
    concurrency_peak: peak,
    cost_ceiling_usd: 0.128,
    provider_disabled_verified: true,
    effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 },
    records,
  });
}

function isDisabledStatus(value) {
  return value?.interface_version === "dice_synthetic_gateway_status_v1" && value?.lumis_ai_enabled === false && value?.provider_access === false && value?.route_default_off === true && value?.active_run_id === null;
}

export function validateEvidencePackage(value) {
  const keys = ["schema", "run_id", "runtime_commit", "runtime_package_sha256", "gateway_package_sha256", "ledger_proof_receipt_sha256", "technical_case_count", "founder_case_count", "language", "attempt_total", "concurrency_peak", "cost_ceiling_usd", "provider_disabled_verified", "effects", "records"];
  exact(value, keys, STOP.evidence);
  if (value.schema !== "s2_t279_dice_technical_evidence_package_v1" || !RUN.test(value.run_id) || value.runtime_commit !== "f5f9e9da238633d84eb8695307c573eef8f1bc96" ||
      value.runtime_package_sha256 !== "f47b7a825dda6ee2a9fba0e269a8e1f7d1f94e96732a9445fa32e6a6fa9c98a5" ||
      value.gateway_package_sha256 !== "3ccc7551fd945b4ca4c3aaeaa7b8f9efd61f29b56e8ebe3c69ea9f5c5aaae8ba" ||
      value.ledger_proof_receipt_sha256 !== "4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e" || value.technical_case_count !== 80 || value.founder_case_count !== 0 ||
      value.language?.en !== 40 || value.language?.["zh-Hant"] !== 40 || !Number.isInteger(value.attempt_total) || value.attempt_total < 0 || value.attempt_total > 160 ||
      value.concurrency_peak > 2 || value.cost_ceiling_usd !== 0.128 || value.provider_disabled_verified !== true || !Array.isArray(value.records) || value.records.length !== 80) stop(STOP.evidence);
  const ids = new Set(value.records.map((record) => record.fixture_id));
  if (ids.size !== 80 || value.records.some((record) => record.phase !== "technical" || /FOUNDER/i.test(record.fixture_id))) stop(STOP.evidence);
  return value;
}
