import { createHash } from "node:crypto";

export const WAITING = "WAITING_FOR_MICROSOFT_FINAL_INTEGRATED_DICE_AUTHORIZATION";
export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "dice-synthetic";
export const INTERFACE_VERSION = "dice_synthetic_gateway_port_v1";
export const DISABLED = "DICE_AI_DISABLED";

export const STOP = Object.freeze({
  control: "STOP_S2_T262_CONTROL_INVALID",
  source: "STOP_S2_T262_SOURCE_SEAL_DRIFT",
  waiting: WAITING,
  authorization: "STOP_S2_T262_MICROSOFT_MANIFEST_INVALID",
  fabricated: "STOP_S2_T262_AUTHORIZATION_BINDING_INVALID",
  replay: "STOP_S2_T262_DEPLOYMENT_ID_REPLAY",
  claimUnavailable: "STOP_S2_T262_DURABLE_CLAIM_AUTHORITY_UNAVAILABLE",
  providerAuthority: "STOP_S2_T262_PROVIDER_AUTHORITY_INVALID",
  pricing: "STOP_S2_T262_PRICING_UNVERIFIED",
  postDeploy: "STOP_S2_T262_POST_DEPLOY_RECEIPT_INVALID",
  disabledProbe: "STOP_S2_T262_DISABLED_PROBE_DRIFT",
  normalChat: "STOP_S2_T262_NORMAL_CHAT_BINDING_DRIFT",
  gateway: "STOP_S2_T262_GATEWAY_PORT_INVALID",
  registry: "STOP_S2_T262_TECHNICAL_REGISTRY_INVALID",
  founder: "STOP_S2_T262_FOUNDER_SCOPE_PROHIBITED",
  cap: "STOP_S2_T262_TECHNICAL_CAP_EXCEEDED",
  retry: "STOP_S2_T262_RETRY_POLICY_INVALID",
  kill: "STOP_S2_T262_KILL_CRITERION",
  disable: "STOP_S2_T262_PROVIDER_DISABLE_UNVERIFIED",
});

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID = /^dice-deploy-[a-z0-9]{16,40}$/;
const FIXTURE_ID = /^DICE-TECH-(EN|ZH)-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{2}$/;
const SOURCE_PATH = /^(?:config|scripts|supabase|package\.json|pnpm-lock\.yaml)/;
const KILL = new Set(["provider_authentication", "provider_permission", "provider_alias_drift", "defaultv2_block", "defaultv2_partial", "unsafe_projection", "cap_state_unavailable", "normal_chat_binding_drift", "disabled_probe_drift", "provider_disable_unverified"]);
const RESULT_CLASSES = new Set(["completed", "safety", "excluded", "fallback", "technical_error"]);
const FAILURE_CODES = new Set(["none", "safety_block", "scope_excluded", "input_token_cap", "output_token_cap", "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_malformed", "attempt_cap", ...KILL]);

export class OperatorStop extends Error {
  constructor(code) { super(code); this.name = "OperatorStop"; this.code = code; }
}

const stop = (code) => { throw new OperatorStop(code); };
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactStringSet = (actual, expected, code) => {
  if (!Array.isArray(actual) || actual.length !== expected.length || new Set(actual).size !== actual.length || expected.some((item) => !actual.includes(item))) stop(code);
};

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function calculateSourceSealSha256(files) {
  if (!isRecord(files)) stop(STOP.control);
  const paths = Object.keys(files).sort();
  if (paths.length === 0 || paths.some((path) => !SOURCE_PATH.test(path) || !SHA.test(files[path]))) stop(STOP.control);
  return sha256(paths.map((path) => `${path}\0${files[path]}`).join("\n"));
}

export async function verifySourceSeal(control, readSource) {
  if (typeof readSource !== "function") stop(STOP.source);
  for (const [path, expected] of Object.entries(control.source_seal.files)) {
    let actual;
    try { actual = sha256(await readSource(path)); } catch { stop(STOP.source); }
    if (actual !== expected) stop(STOP.source);
  }
  if (calculateSourceSealSha256(control.source_seal.files) !== control.source_seal.package_sha256) stop(STOP.source);
  return control.source_seal.package_sha256;
}

const EXPECTED_PROVIDER_AUTHORITY = Object.freeze({
  deployment_alias: "lumis-ai-chat-stg",
  model: "gpt-5-mini",
  model_version: "2025-08-07",
  deployment_type: "GlobalStandard",
  model_version_upgrade_policy: "NoAutoUpgrade",
  guardrail: "Microsoft.DefaultV2",
  tokens_per_minute_limit: 10000,
  requests_per_minute_limit: 10,
  foundry_service_hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
  transport: "https",
  api_route_family: "v1",
});

const EXPECTED_EVIDENCE_BOUND_PRICING = Object.freeze({
  input_price_usd_per_1m_tokens: 0.25,
  output_price_usd_per_1m_tokens: 2,
  calculated_provider_maximum_usd: 0.128,
  full_maximum_dice_window_estimate_usd: 0.192,
  absolute_window_cap_usd: 1,
  azure_api_version: null,
  status: "EVIDENCE_BOUND_ROUTE_V1_NO_TRAFFIC_AUTHORITY",
});

export function validateControl(control) {
  const keys = ["schema", "status", "project_ref", "function_name", "gateway_interface", "deployment_claim_interface", "canonical_sha256", "source_seal", "readonly_evidence", "sanitized_price_evidence", "api_route_evidence", "provider_authority", "pricing", "normal_chat_binding", "configuration_names", "disabled_probe_names", "technical_limits", "kill_criteria", "microsoft_authorization", "network_calls_in_default_mode"];
  exact(control, keys, STOP.control);
  if (control.schema !== "s2_t262_dice_integrated_authorization_control_v1" || control.status !== WAITING || control.project_ref !== PROJECT_REF || control.function_name !== FUNCTION_NAME || control.gateway_interface !== INTERFACE_VERSION || control.network_calls_in_default_mode !== 0) stop(STOP.control);
  exact(control.deployment_claim_interface, ["interface_version", "durability"], STOP.control);
  if (control.deployment_claim_interface.interface_version !== "lumis_dice_deployment_claim_store_v1" || control.deployment_claim_interface.durability !== "atomic_persistent") stop(STOP.control);
  exact(control.canonical_sha256, ["gateway", "registry", "registry_payload", "adapter", "response_schema", "operator"], STOP.control);
  if (Object.values(control.canonical_sha256).some((value) => !SHA.test(value))) stop(STOP.control);
  exact(control.source_seal, ["base_commit", "algorithm", "package_sha256", "files"], STOP.control);
  if (control.source_seal.base_commit !== "083af57ed7685419fc093fb0f1e467385a5039ff" || control.source_seal.algorithm !== "sha256_sorted_path_nul_digest_v1" || !SHA.test(control.source_seal.package_sha256) || calculateSourceSealSha256(control.source_seal.files) !== control.source_seal.package_sha256) stop(STOP.control);
  exact(control.readonly_evidence, ["path", "sha256"], STOP.control);
  if (control.readonly_evidence.path !== "config/evidence/s2-t262-azure-foundry-deployment-readonly-v1.json" || control.readonly_evidence.sha256 !== "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f") stop(STOP.control);
  exact(control.sanitized_price_evidence, ["path", "sha256"], STOP.control);
  if (control.sanitized_price_evidence.path !== "config/evidence/s2-t262-azure-foundry-sanitized-price-v1.json" || control.sanitized_price_evidence.sha256 !== "2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772") stop(STOP.control);
  exact(control.api_route_evidence, ["path", "sha256", "official_reference"], STOP.control);
  exact(control.api_route_evidence.official_reference, ["url", "url_sha256"], STOP.control);
  if (control.api_route_evidence.path !== "config/evidence/s2-t262-azure-foundry-api-route-family-v1.json" || control.api_route_evidence.sha256 !== "2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e" || control.api_route_evidence.official_reference.url !== "https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses" || sha256(control.api_route_evidence.official_reference.url) !== control.api_route_evidence.official_reference.url_sha256) stop(STOP.control);
  if (!sameJson(control.provider_authority, EXPECTED_PROVIDER_AUTHORITY)) stop(STOP.providerAuthority);
  if (!sameJson(control.pricing, EXPECTED_EVIDENCE_BOUND_PRICING)) stop(STOP.pricing);
  const rawMaximum = control.technical_limits.attempt_total * (
    control.technical_limits.input_tokens_per_attempt * control.pricing.input_price_usd_per_1m_tokens
    + control.technical_limits.output_tokens_per_attempt * control.pricing.output_price_usd_per_1m_tokens
  ) / 1_000_000;
  if (rawMaximum !== control.pricing.calculated_provider_maximum_usd || control.pricing.full_maximum_dice_window_estimate_usd < rawMaximum || control.pricing.full_maximum_dice_window_estimate_usd > control.pricing.absolute_window_cap_usd) stop(STOP.pricing);
  exact(control.normal_chat_binding, ["base_commit", "tree", "entry_blob"], STOP.control);
  if (Object.values(control.normal_chat_binding).some((value) => !COMMIT.test(value))) stop(STOP.control);
  exactStringSet(control.configuration_names, ["LUMIS_DICE_AI_ENABLED", "LUMIS_DICE_TRAFFIC_AUTHORIZED", "LUMIS_DICE_AZURE_API_KEY", "LUMIS_DICE_AUTHORITY_HMAC_SECRET", "LUMIS_DICE_DEPLOYMENT_ALIAS", "LUMIS_DICE_MODEL", "LUMIS_DICE_MODEL_VERSION", "LUMIS_DICE_DEPLOYMENT_TYPE", "LUMIS_DICE_UPGRADE_POLICY", "LUMIS_DICE_GUARDRAIL", "LUMIS_DICE_TPM_LIMIT", "LUMIS_DICE_RPM_LIMIT", "LUMIS_DICE_FOUNDRY_HOSTNAME", "LUMIS_DICE_FOUNDRY_PROTOCOL", "LUMIS_DICE_API_ROUTE_FAMILY"], STOP.control);
  if (control.microsoft_authorization?.status === "AWAITING_MICROSOFT_MANIFEST") {
    exact(control.microsoft_authorization, ["status"], STOP.control);
  } else if (control.microsoft_authorization?.status === "AUTHORIZED") {
    exact(control.microsoft_authorization, ["status", "manifest_sha256"], STOP.control);
    if (!SHA.test(control.microsoft_authorization.manifest_sha256)) stop(STOP.control);
  } else stop(STOP.control);
  if (!Array.isArray(control.kill_criteria) || KILL.size !== control.kill_criteria.length || [...KILL].some((item) => !control.kill_criteria.includes(item))) stop(STOP.control);
  return control;
}

export function validateMicrosoftAuthorization(manifest, rawText, control, now = Date.now()) {
  const keys = ["schema", "issuer", "decision", "project_ref", "function_name", "single_use_deployment_id", "issued_at", "expires_at", "integrated_source_seal_sha256", "readonly_evidence_sha256", "sanitized_price_evidence_sha256", "api_route_evidence_sha256", "canonical_sha256", "provider_authority", "pricing", "normal_chat_binding", "configuration_names", "technical_scope"];
  exact(manifest, keys, STOP.authorization);
  exact(manifest.normal_chat_binding, ["base_commit", "tree", "entry_blob", "unchanged_required"], STOP.authorization);
  exact(manifest.technical_scope, ["operator", "logical_total", "en", "zh_hant", "founder_total"], STOP.authorization);
  if (manifest.schema !== "lumis_dice_microsoft_deployment_manifest_v1" || manifest.issuer !== "Microsoft" || manifest.decision !== "AUTHORIZED_DEFAULT_OFF_DEPLOYMENT" || manifest.project_ref !== PROJECT_REF || manifest.function_name !== FUNCTION_NAME || !DEPLOYMENT_ID.test(manifest.single_use_deployment_id) || !SHA.test(manifest.integrated_source_seal_sha256)) stop(STOP.authorization);
  const issued = Date.parse(manifest.issued_at);
  const expires = Date.parse(manifest.expires_at);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now + 300_000 || expires <= now || expires <= issued || expires - issued > 86_400_000) stop(STOP.authorization);
  if (manifest.integrated_source_seal_sha256 !== control.source_seal.package_sha256 || manifest.readonly_evidence_sha256 !== control.readonly_evidence.sha256 || manifest.sanitized_price_evidence_sha256 !== control.sanitized_price_evidence.sha256 || manifest.api_route_evidence_sha256 !== control.api_route_evidence.sha256 || !sameJson(manifest.canonical_sha256, control.canonical_sha256)) stop(STOP.fabricated);
  if (!sameJson(manifest.provider_authority, control.provider_authority)) stop(STOP.providerAuthority);
  if (!sameJson(manifest.pricing, control.pricing)) stop(STOP.pricing);
  if (!sameJson({ base_commit: manifest.normal_chat_binding.base_commit, tree: manifest.normal_chat_binding.tree, entry_blob: manifest.normal_chat_binding.entry_blob }, control.normal_chat_binding) || manifest.normal_chat_binding.unchanged_required !== true) stop(STOP.normalChat);
  exactStringSet(manifest.configuration_names, control.configuration_names, STOP.authorization);
  const limits = control.technical_limits;
  if (!sameJson(manifest.technical_scope, { operator: "TECHNICAL_80_ONLY", logical_total: limits.logical_total, en: limits.en, zh_hant: limits.zh_hant, founder_total: 0 })) stop(manifest.technical_scope?.founder_total ? STOP.founder : STOP.authorization);
  const manifestSha256 = sha256(rawText);
  if (manifest.pricing.status === "EVIDENCE_BOUND_ROUTE_V1_NO_TRAFFIC_AUTHORITY") stop(STOP.waiting);
  if (control.microsoft_authorization.status !== "AUTHORIZED" || control.microsoft_authorization.manifest_sha256 !== manifestSha256) stop(STOP.waiting);
  return Object.freeze({ sha256: manifestSha256, value: Object.freeze({ ...manifest }) });
}

export function validatePostDeployReceipt(receipt, authorization, control, now = Date.now()) {
  const keys = ["schema", "project_ref", "function_name", "single_use_deployment_id", "microsoft_manifest_sha256", "integrated_source_seal_sha256", "function_version", "configuration_names_present", "disabled_before", "disabled_during", "disabled_after", "disabled_probes", "provider_calls", "normal_chat_binding", "normal_chat_unchanged", "deployed_at"];
  exact(receipt, keys, STOP.postDeploy);
  exact(receipt.disabled_probes, control.disabled_probe_names, STOP.postDeploy);
  exact(receipt.normal_chat_binding, ["base_commit", "tree", "entry_blob"], STOP.postDeploy);
  const deployed = Date.parse(receipt.deployed_at);
  if (receipt.schema !== "lumis_dice_default_off_post_deploy_receipt_v1" || receipt.project_ref !== PROJECT_REF || receipt.function_name !== FUNCTION_NAME || receipt.single_use_deployment_id !== authorization.value.single_use_deployment_id || receipt.microsoft_manifest_sha256 !== authorization.sha256 || receipt.integrated_source_seal_sha256 !== control.source_seal.package_sha256 || !Number.isInteger(receipt.function_version) || receipt.function_version < 1 || receipt.disabled_before !== true || receipt.disabled_during !== true || receipt.disabled_after !== true || receipt.provider_calls !== 0 || receipt.normal_chat_unchanged !== true || !Number.isFinite(deployed) || deployed < Date.parse(authorization.value.issued_at) || deployed > Date.parse(authorization.value.expires_at) || deployed > now + 300_000) stop(STOP.postDeploy);
  exactStringSet(receipt.configuration_names_present, control.configuration_names, STOP.postDeploy);
  if (control.disabled_probe_names.some((name) => receipt.disabled_probes[name] !== DISABLED)) stop(STOP.disabledProbe);
  if (!sameJson(receipt.normal_chat_binding, control.normal_chat_binding)) stop(STOP.normalChat);
  return Object.freeze({ ...receipt });
}

export function validateTechnicalRegistry(registry, control) {
  exact(registry, ["schema", "registry_payload_sha256", "fixtures"], STOP.registry);
  if (registry.schema !== "lumis_dice_technical_registry_v1" || registry.registry_payload_sha256 !== control.canonical_sha256.registry_payload || !Array.isArray(registry.fixtures) || registry.fixtures.length !== 80) stop(STOP.registry);
  const seen = new Set();
  const counts = { en: 0, "zh-Hant": 0 };
  for (const fixture of registry.fixtures) {
    exact(fixture, ["fixture_id", "language", "phase"], STOP.registry);
    const match = FIXTURE_ID.exec(fixture.fixture_id);
    if (!match || seen.has(fixture.fixture_id) || fixture.phase !== "technical" || /FOUNDER/.test(fixture.fixture_id)) stop(/FOUNDER/.test(fixture.fixture_id) ? STOP.founder : STOP.registry);
    const language = match[1] === "EN" ? "en" : "zh-Hant";
    if (fixture.language !== language) stop(STOP.registry);
    seen.add(fixture.fixture_id);
    counts[language] += 1;
  }
  if (counts.en !== 40 || counts["zh-Hant"] !== 40) stop(STOP.registry);
  return Object.freeze(registry.fixtures.map((fixture) => Object.freeze({ ...fixture })));
}

function disabled(status) {
  return isRecord(status) && status.interface_version === "dice_synthetic_gateway_status_v1" && status.lumis_ai_enabled === false && status.provider_access === false && status.route_default_off === true && status.active_run_id === null;
}

function validateEvidence(evidence, fixtures, control) {
  exact(evidence, ["schema", "run_id", "technical_case_count", "founder_case_count", "attempt_total", "tokenizer_vocabulary", "provider_disabled_verified", "records"], STOP.cap);
  if (evidence.schema !== "lumis_dice_synthetic_metadata_evidence_package_v1" || evidence.technical_case_count !== 80 || evidence.founder_case_count !== 0 || evidence.tokenizer_vocabulary !== "o200k_base" || evidence.provider_disabled_verified !== true || !Array.isArray(evidence.records) || evidence.records.length !== 80 || !Number.isInteger(evidence.attempt_total) || evidence.attempt_total < 0 || evidence.attempt_total > 160) stop(STOP.cap);
  const expected = new Map(fixtures.map((fixture) => [fixture.fixture_id, fixture.language]));
  const seen = new Set();
  let attempts = 0;
  for (const record of evidence.records) {
    const keys = ["schema", "run_id", "fixture_id", "phase", "language", "result_class", "attempt_count", "input_tokens", "output_tokens", "duration_ms", "concurrency_peak", "redacted_failure_code", "observed_at", "retain_until", "effects"];
    exact(record, keys, STOP.cap);
    if (record.schema !== "lumis_dice_synthetic_metadata_evidence_v1" || record.run_id !== evidence.run_id || record.phase !== "technical" || expected.get(record.fixture_id) !== record.language || seen.has(record.fixture_id) || !RESULT_CLASSES.has(record.result_class) || !FAILURE_CODES.has(record.redacted_failure_code) || KILL.has(record.redacted_failure_code)) stop(KILL.has(record.redacted_failure_code) ? STOP.kill : STOP.cap);
    if (!Number.isInteger(record.attempt_count) || record.attempt_count < 0 || record.attempt_count > 2 || !Number.isInteger(record.input_tokens) || record.input_tokens < 0 || record.input_tokens > control.technical_limits.input_tokens_per_attempt || !Number.isInteger(record.output_tokens) || record.output_tokens < 0 || (record.output_tokens > control.technical_limits.output_tokens_per_attempt && record.redacted_failure_code !== "output_token_cap") || !Number.isFinite(record.duration_ms) || record.duration_ms < 0 || record.duration_ms > control.technical_limits.shared_deadline_ms || !Number.isInteger(record.concurrency_peak) || record.concurrency_peak < 0 || record.concurrency_peak > control.technical_limits.concurrency) stop(STOP.cap);
    exact(record.effects, ["normal_routes", "units_charged", "persistence_writes"], STOP.cap);
    if (record.effects.normal_routes !== 0 || record.effects.units_charged !== 0 || record.effects.persistence_writes !== 0) stop(STOP.cap);
    seen.add(record.fixture_id);
    attempts += record.attempt_count;
  }
  if (seen.size !== expected.size || attempts !== evidence.attempt_total) stop(STOP.cap);
  return evidence;
}

export async function runTechnical80({ control, authorization, postDeployReceipt, registry, claimDeployment, createGatewayExecution, now = Date.now() }) {
  validateControl(control);
  validatePostDeployReceipt(postDeployReceipt, authorization, control, now);
  const fixtures = validateTechnicalRegistry(registry, control);
  const claimContract = control.deployment_claim_interface;
  if (typeof claimDeployment !== "function" || claimDeployment.interfaceVersion !== claimContract.interface_version || claimDeployment.durability !== claimContract.durability) stop(STOP.claimUnavailable);
  let claim;
  try { claim = await claimDeployment({ interface_version: claimContract.interface_version, deployment_id: authorization.value.single_use_deployment_id }); }
  catch (error) { if (error instanceof OperatorStop && error.code === STOP.replay) throw error; stop(STOP.claimUnavailable); }
  exact(claim, ["interface_version", "status", "deployment_id", "durable"], STOP.claimUnavailable);
  if (claim.interface_version !== claimContract.interface_version || claim.status !== "CLAIMED" || claim.deployment_id !== authorization.value.single_use_deployment_id || claim.durable !== true) stop(STOP.claimUnavailable);
  if (typeof createGatewayExecution !== "function") stop(STOP.gateway);
  const execution = await createGatewayExecution();
  exact(execution, ["gateway", "gateway_authorization"], STOP.gateway);
  const gateway = execution.gateway;
  if (!isRecord(gateway) || typeof gateway.describe !== "function" || typeof gateway.status !== "function" || typeof gateway.executeAuthorizedWindow !== "function") stop(STOP.gateway);
  const descriptor = gateway.describe();
  if (!isRecord(descriptor) || descriptor.interface_version !== INTERFACE_VERSION || descriptor.gateway_package_sha256 !== control.source_seal.package_sha256 || descriptor.fixture_registry_sha256 !== control.canonical_sha256.registry || descriptor.technical_case_count !== 80 || descriptor.founder_case_count !== 0 || descriptor.normal_routes !== 0 || descriptor.units_charged !== 0 || descriptor.persistence_writes !== 0) stop(STOP.gateway);
  if (!disabled(gateway.status())) stop(STOP.disable);
  let evidence;
  let original;
  try { evidence = validateEvidence(await gateway.executeAuthorizedWindow(execution.gateway_authorization), fixtures, control); }
  catch (error) { original = error; }
  let finalDisabled = false;
  try { finalDisabled = disabled(gateway.status()); } catch { finalDisabled = false; }
  if (!finalDisabled) stop(STOP.disable);
  if (original) throw original;
  return Object.freeze({ status: "TECHNICAL_80_COMPLETE_PROVIDER_DISABLED", deployment_id: authorization.value.single_use_deployment_id, logical_total: 80, en: 40, zh_hant: 40, founder_total: 0, attempt_total: evidence.attempt_total, provider_disabled_verified: true });
}
