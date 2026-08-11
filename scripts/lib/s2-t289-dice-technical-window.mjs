import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const STOP = Object.freeze({
  deployment: "WAITING_FOR_ACCEPTED_DICE_V4_POST_DEPLOY_DISABLED_RECEIPT",
  migration: "WAITING_FOR_ACCEPTED_DICE_0039_MIGRATION_RECEIPT",
  traffic: "WAITING_FOR_MICROSOFT_DICE_TECHNICAL_TRAFFIC_AUTHORITY",
  source: "STOP_S2_T289_SEALED_SOURCE_DRIFT",
  registry: "STOP_S2_T289_TECHNICAL_REGISTRY_INVALID",
  replay: "STOP_S2_T289_RUN_AUTHORITY_REPLAYED",
  attempts: "STOP_S2_T289_ATTEMPT_CAP",
  unsafe: "STOP_S2_T289_UNSAFE_EVIDENCE",
  provider: "STOP_S2_T289_PROVIDER_KILL_CRITERION",
  disable: "STOP_S2_T289_POST_WINDOW_DISABLE_FAILED",
  evidence: "STOP_S2_T289_EVIDENCE_INVALID",
});

export class TechnicalWindowStop extends Error {
  constructor(code) { super(code); this.name = "TechnicalWindowStop"; this.code = code; }
}

const SHA = /^[a-f0-9]{64}$/;
const RUN = /^dice-tech80-[a-z0-9]{16,40}$/;
const DEPLOY = /^dice-deploy-[a-z0-9]{16,40}$/;
const FIXTURE = /^DICE-TECH-(EN|ZH)-[A-Z0-9-]+-[0-9]{2}$/;
const RESULTS = new Set(["completed", "safety", "excluded", "fallback", "technical_error"]);
const FAILURES = new Set(["none", "safety_block", "scope_excluded", "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_malformed", "defaultv2_block", "defaultv2_partial", "input_token_cap", "output_token_cap"]);
const FORBIDDEN = ["prompt", "response", "question", "member_id", "account_id", "device_id", "endpoint", "api_key", "secret", "raw_error"];

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
  const control = JSON.parse(readFileSync(`${root}/config/s2-t289-dice-v4-technical-window.json`, "utf8"));
  const registry = JSON.parse(readFileSync(`${root}/${control.registry.path}`, "utf8"));
  if (control.schema !== "s2_t289_dice_v4_technical_window_control_v1" ||
      control.deployment.schema !== "lumis_dice_default_off_function_deployment_authorization_v4" ||
      control.deployment.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" ||
      control.deployment.authority_commit !== "fc0e516835b2a693344a4e86e558898ee1cf4237" ||
      control.migration.proof_commit !== "b469cb7e0824bd6b864edc983bcd352b37994894" ||
      control.migration.proof_receipt_sha256 !== "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e" ||
      control.migration.authorization_scope !== "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY" ||
      fileSha256(`${root}/${control.registry.path}`) !== control.registry.file_sha256 ||
      registry.schema !== "lumis_dice_technical_registry_v1" || registry.fixtures?.length !== 80) stop(STOP.source);
  const retired = ["f47b" + "7a82", "3ccc" + "7551", "authorization_" + "v3", "T" + "254", "t" + "254"];
  if (retired.some((marker) => JSON.stringify(control).includes(marker))) stop(STOP.source);
  validateRegistry(registry.fixtures);
  const price = JSON.parse(readFileSync(`${root}/${control.pricing.evidence_file}`, "utf8"));
  const ceiling = 160 * ((800 * price.input_price_usd_per_1m_tokens + 300 * price.output_price_usd_per_1m_tokens) / 1_000_000);
  if (price.currency !== "USD" || price.input_price_usd_per_1m_tokens !== 0.25 || price.output_price_usd_per_1m_tokens !== 2 || Number(ceiling.toFixed(3)) !== 0.128) stop(STOP.source);
  return Object.freeze({ control, registry });
}

export function validateRegistry(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length !== 80) stop(STOP.registry);
  const seen = new Set(); const languages = { en: 0, "zh-Hant": 0 };
  for (const fixture of fixtures) {
    exact(fixture, ["fixture_id", "language", "phase"], STOP.registry);
    if (!FIXTURE.test(fixture.fixture_id) || fixture.phase !== "technical" || !Object.hasOwn(languages, fixture.language) || seen.has(fixture.fixture_id) || /FOUNDER/i.test(fixture.fixture_id)) stop(STOP.registry);
    seen.add(fixture.fixture_id); languages[fixture.language] += 1;
  }
  if (languages.en !== 40 || languages["zh-Hant"] !== 40) stop(STOP.registry);
  return fixtures;
}

export function validateDeploymentReceipt(value, control, now = Date.now()) {
  exact(value, ["schema", "authorization_schema", "project_ref", "function_name", "deployment_id", "source_commit", "runtime_package_sha256", "disabled_probes", "provider_calls", "model_invocations", "kill_switch_disabled", "traffic_switch_disabled", "migration_applied", "deployed_at", "valid_until"], STOP.deployment);
  const deployed = Date.parse(value.deployed_at); const expires = Date.parse(value.valid_until);
  if (value.schema !== "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1" || value.authorization_schema !== control.deployment.schema || value.project_ref !== control.project_ref || value.function_name !== control.function_name || !DEPLOY.test(value.deployment_id) || value.source_commit !== control.deployment.authority_commit || value.runtime_package_sha256 !== control.deployment.runtime_package_sha256 || value.provider_calls !== 0 || value.model_invocations !== 0 || value.kill_switch_disabled !== true || value.traffic_switch_disabled !== true || value.migration_applied !== false || !Number.isFinite(deployed) || !Number.isFinite(expires) || deployed > now || expires <= now) stop(STOP.deployment);
  exact(value.disabled_probes, ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"], STOP.deployment);
  if (Object.values(value.disabled_probes).some((result) => result !== "DICE_AI_DISABLED")) stop(STOP.deployment);
  return value;
}

export function validateMigrationReceipt(value, control, now = Date.now()) {
  exact(value, ["schema", "authorization_scope", "project_ref", "migration_version", "migration_sha256", "proof_commit", "proof_receipt_schema", "proof_receipt_sha256", "applied", "parity_verified", "rpc_rls_verified", "concurrency_replay_caps_verified", "cleanup_verified", "provider_calls", "issued_at", "valid_until"], STOP.migration);
  const issued = Date.parse(value.issued_at); const expires = Date.parse(value.valid_until);
  if (value.schema !== "s2_t289_accepted_t283_migration_0039_receipt_v1" || value.authorization_scope !== control.migration.authorization_scope || value.project_ref !== control.project_ref || value.migration_version !== "0039" || value.migration_sha256 !== control.migration.migration_sha256 || value.proof_commit !== control.migration.proof_commit || value.proof_receipt_schema !== "s2_t283_dice_migration_0039_proof_receipt_v1" || value.proof_receipt_sha256 !== control.migration.proof_receipt_sha256 || value.applied !== true || value.parity_verified !== true || value.rpc_rls_verified !== true || value.concurrency_replay_caps_verified !== true || value.cleanup_verified !== true || value.provider_calls !== 0 || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now) stop(STOP.migration);
  return value;
}

export function validateTrafficAuthority(value, control, deployment, migration, now = Date.now()) {
  exact(value, ["schema", "issuer", "decision", "authorization_scope", "single_use_run_id", "deployment_id", "migration_version", "runtime_package_sha256", "migration_proof_receipt_sha256", "registry_sha256", "technical_cases", "language", "founder_cases", "attempt_cap", "concurrency", "eligible_retries", "shared_deadline_ms", "input_token_cap", "output_token_cap", "tokenizer", "cost_ceiling_usd", "issued_at", "valid_until", "signature_algorithm", "microsoft_signature_base64"], STOP.traffic);
  const issued = Date.parse(value.issued_at); const expires = Date.parse(value.valid_until);
  if (value.schema !== "lumis_dice_technical_synthetic_window_80_authorization_v1" || value.issuer !== "Microsoft" || value.decision !== "AUTHORIZED" || value.authorization_scope !== "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" || !RUN.test(value.single_use_run_id) || value.deployment_id !== deployment.deployment_id || value.migration_version !== migration.migration_version || value.runtime_package_sha256 !== control.deployment.runtime_package_sha256 || value.migration_proof_receipt_sha256 !== control.migration.proof_receipt_sha256 || value.registry_sha256 !== control.registry.payload_sha256 || value.technical_cases !== 80 || value.language?.en !== 40 || value.language?.["zh-Hant"] !== 40 || value.founder_cases !== 0 || value.attempt_cap !== 160 || value.concurrency !== 2 || value.eligible_retries !== 1 || value.shared_deadline_ms !== 12000 || value.input_token_cap !== 800 || value.output_token_cap !== 300 || value.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || value.cost_ceiling_usd !== 0.128 || value.signature_algorithm !== "Ed25519" || !/^[A-Za-z0-9+/]{86}==$/.test(value.microsoft_signature_base64) || !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now || expires - issued > 15 * 60_000) stop(STOP.traffic);
  return value;
}

export function validateProviderEvidence(value, fixture, runId) {
  exact(value, ["schema", "run_id", "fixture_id", "phase", "language", "result_class", "attempt_count", "input_tokens", "output_tokens", "duration_ms", "concurrency_peak", "redacted_failure_code", "observed_at", "retain_until", "effects"], STOP.unsafe);
  if (FORBIDDEN.some((key) => JSON.stringify(value).toLowerCase().includes(key))) stop(STOP.unsafe);
  exact(value.effects, ["normal_routes", "units_charged", "persistence_writes"], STOP.unsafe);
  if (value.schema !== "lumis_dice_synthetic_metadata_evidence_v1" || value.run_id !== runId || value.fixture_id !== fixture.fixture_id || value.phase !== "technical" || value.language !== fixture.language || !RESULTS.has(value.result_class) || !FAILURES.has(value.redacted_failure_code) || !Number.isInteger(value.attempt_count) || value.attempt_count < 0 || value.attempt_count > 2 || !Number.isInteger(value.input_tokens) || value.input_tokens < 0 || value.input_tokens > 800 || !Number.isInteger(value.output_tokens) || value.output_tokens < 0 || value.output_tokens > 300 || !Number.isFinite(value.duration_ms) || value.duration_ms < 0 || value.duration_ms > 12000 || !Number.isInteger(value.concurrency_peak) || value.concurrency_peak < 0 || value.concurrency_peak > 2 || Object.values(value.effects).some((count) => count !== 0)) stop(STOP.unsafe);
  const observed = Date.parse(value.observed_at); const retained = Date.parse(value.retain_until);
  if (!Number.isFinite(observed) || retained - observed !== 30 * 86_400_000) stop(STOP.unsafe);
  return Object.freeze(structuredClone(value));
}

const isDisabled = (value) => value?.interface_version === "dice_synthetic_gateway_status_v1" && value?.lumis_ai_enabled === false && value?.provider_access === false && value?.route_default_off === true && value?.active_run_id === null;

export async function runTechnicalWindow({ gateway, deploymentReceipt, migrationReceipt, trafficAuthority, root = process.cwd(), claimRun = async () => true, onRecord = async () => {} }) {
  const { control, registry } = loadAndValidateControl(root);
  const deployment = validateDeploymentReceipt(deploymentReceipt, control);
  const migration = validateMigrationReceipt(migrationReceipt, control);
  const authority = validateTrafficAuthority(trafficAuthority, control, deployment, migration);
  if (!gateway || typeof gateway.status !== "function" || typeof gateway.executeAuthorizedWindow !== "function" || !isDisabled(await gateway.status())) stop(STOP.deployment);
  if (await claimRun(authority.single_use_run_id) !== true) stop(STOP.replay);
  let raw; let original;
  try { raw = await gateway.executeAuthorizedWindow({ run_id: authority.single_use_run_id, fixture_ids: registry.fixtures.map((fixture) => fixture.fixture_id) }); }
  catch (error) { original = error; }
  finally { if (!isDisabled(await gateway.status().catch(() => null))) throw new TechnicalWindowStop(STOP.disable); }
  if (original) throw original;
  exact(raw, ["schema", "run_id", "technical_case_count", "founder_case_count", "attempt_total", "tokenizer_vocabulary", "provider_disabled_verified", "records"], STOP.evidence);
  if (raw.schema !== "lumis_dice_synthetic_metadata_evidence_package_v1" || raw.run_id !== authority.single_use_run_id || raw.technical_case_count !== 80 || raw.founder_case_count !== 0 || raw.attempt_total > 160 || raw.tokenizer_vocabulary !== "o200k_base" || raw.provider_disabled_verified !== true || !Array.isArray(raw.records) || raw.records.length !== 80) stop(STOP.evidence);
  const records = []; let attempts = 0; let peak = 0;
  for (let index = 0; index < 80; index += 1) { const record = validateProviderEvidence(raw.records[index], registry.fixtures[index], authority.single_use_run_id); attempts += record.attempt_count; peak = Math.max(peak, record.concurrency_peak); records.push(record); await onRecord(record); }
  if (attempts !== raw.attempt_total || attempts > 160 || peak > 2) stop(STOP.attempts);
  const language = records.reduce((out, record) => ({ ...out, [record.language]: out[record.language] + 1 }), { en: 0, "zh-Hant": 0 });
  if (language.en !== 40 || language["zh-Hant"] !== 40) stop(STOP.evidence);
  return Object.freeze({ schema: "s2_t289_dice_technical_evidence_package_v1", run_id: authority.single_use_run_id, deployment_id: deployment.deployment_id, runtime_package_sha256: control.deployment.runtime_package_sha256, migration_proof_receipt_sha256: control.migration.proof_receipt_sha256, registry_sha256: control.registry.payload_sha256, technical_case_count: 80, founder_case_count: 0, language, attempt_total: attempts, concurrency_peak: peak, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128, provider_disabled_verified: true, effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 }, records });
}

export function validateEvidencePackage(value) {
  exact(value, ["schema", "run_id", "deployment_id", "runtime_package_sha256", "migration_proof_receipt_sha256", "registry_sha256", "technical_case_count", "founder_case_count", "language", "attempt_total", "concurrency_peak", "tokenizer", "cost_ceiling_usd", "provider_disabled_verified", "effects", "records"], STOP.evidence);
  if (value.schema !== "s2_t289_dice_technical_evidence_package_v1" || !RUN.test(value.run_id) || !DEPLOY.test(value.deployment_id) || value.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || value.migration_proof_receipt_sha256 !== "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e" || value.technical_case_count !== 80 || value.founder_case_count !== 0 || value.language?.en !== 40 || value.language?.["zh-Hant"] !== 40 || value.attempt_total > 160 || value.concurrency_peak > 2 || value.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || value.cost_ceiling_usd !== 0.128 || value.provider_disabled_verified !== true || !Array.isArray(value.records) || value.records.length !== 80 || new Set(value.records.map((record) => record.fixture_id)).size !== 80) stop(STOP.evidence);
  return value;
}
