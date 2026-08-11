import { createHash, createPublicKey, verify } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "dice-synthetic";
export const SCOPE = "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY";
export const WAITING = "WAITING_FOR_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION";
export const DISABLED = "DICE_AI_DISABLED";
export const T272_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96";
export const T272_TREE = "666558397b6247ffa54b25ff8ac3f5c64ff5989e";

export const STOP = Object.freeze({
  control: "STOP_S2_T277_CONTROL_INVALID",
  source: "STOP_S2_T277_SOURCE_DRIFT",
  authorization: "STOP_S2_T277_AUTHORIZATION_REQUIRED",
  authorizationShape: "STOP_S2_T277_AUTHORIZATION_INVALID",
  authorizationStale: "STOP_S2_T277_AUTHORIZATION_STALE",
  signature: "STOP_S2_T277_MICROSOFT_SIGNATURE_INVALID",
  project: "STOP_S2_T277_WRONG_PROJECT",
  function: "STOP_S2_T277_WRONG_FUNCTION",
  package: "STOP_S2_T277_WRONG_PACKAGE",
  replay: "STOP_S2_T277_DEPLOYMENT_CLAIM_REPLAYED",
  claim: "STOP_S2_T277_DEPLOYMENT_CLAIM_FAILED",
  migration: "STOP_S2_T277_MIGRATION_NOT_AUTHORIZED",
  receipt: "STOP_S2_T277_POST_DEPLOY_RECEIPT_INVALID",
  probe: "STOP_S2_T277_DISABLED_PROBE_INVALID",
  rollback: "STOP_S2_T277_ROLLBACK_RECEIPT_INVALID",
});

export class DeploymentStop extends Error {
  constructor(code) { super(code); this.name = "DeploymentStop"; this.code = code; }
}

const stop = (code) => { throw new DeploymentStop(code); };
const SHA = /^[a-f0-9]{64}$/u;
const DEPLOYMENT_ID = /^dice-deploy-[a-z0-9]{16,40}$/u;
const REVISION = /^[a-zA-Z0-9._:-]{1,120}$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameArray = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const unsignedReceiptBytes = (receipt) => {
  const { microsoft_signature_base64: _signature, ...unsigned } = receipt;
  return Buffer.from(`${JSON.stringify(unsigned)}\n`, "utf8");
};

export function validateControl(control) {
  exact(control, ["schema", "status", "authorization_scope", "project_ref", "function_name", "source_commit", "source_tree", "runtime_package_sha256", "bindings", "runtime_proof", "configuration_names", "kill_switch", "traffic_switch", "provider_calls_authorized", "model_invocations_authorized", "disabled_probes", "migration_boundary", "normal_chat_binding", "authorization", "rollback", "remote_calls_in_default_mode", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t277_dice_default_off_deployment_control_v1" || control.status !== WAITING || control.authorization_scope !== SCOPE || control.project_ref !== PROJECT_REF || control.function_name !== FUNCTION_NAME) stop(STOP.control);
  if (control.source_commit !== T272_COMMIT || control.source_tree !== T272_TREE || !SHA.test(control.runtime_package_sha256)) stop(STOP.package);
  const bindingNames = ["release_manifest", "registry", "gateway", "handler", "entry", "deno_config", "tokenizer", "adapter", "deployment_operator", "deployment_validator", "deployment_receipt_helper", "runtime_recheck_operator", "runtime_control", "runtime_receipt", "runtime_import_graph", "runtime_recheck_receipt"];
  exact(control.bindings, bindingNames, STOP.control);
  for (const binding of Object.values(control.bindings)) {
    exact(binding, ["path", "sha256"], STOP.control);
    if (typeof binding.path !== "string" || !SHA.test(binding.sha256)) stop(STOP.control);
  }
  exact(control.runtime_proof, ["deno_check", "edge_eszip_bundle", "edge_eszip_sha256", "disabled_before_json_parse_and_client_construction", "provider_calls", "remote_calls"], STOP.control);
  if (control.runtime_proof.deno_check !== "passed" || control.runtime_proof.edge_eszip_bundle !== "passed" || !SHA.test(control.runtime_proof.edge_eszip_sha256) || control.runtime_proof.disabled_before_json_parse_and_client_construction !== true || control.runtime_proof.provider_calls !== 0 || control.runtime_proof.remote_calls !== 0) stop(STOP.control);
  if (!sameArray(control.configuration_names, ["LUMIS_DICE_AI_ENABLED", "LUMIS_DICE_TRAFFIC_AUTHORIZED", "LUMIS_DICE_AZURE_API_KEY", "LUMIS_DICE_AUTHORITY_HMAC_SECRET", "LUMIS_DICE_DEPLOYMENT_ALIAS", "LUMIS_DICE_MODEL", "LUMIS_DICE_MODEL_VERSION", "LUMIS_DICE_DEPLOYMENT_TYPE", "LUMIS_DICE_UPGRADE_POLICY", "LUMIS_DICE_GUARDRAIL", "LUMIS_DICE_TPM_LIMIT", "LUMIS_DICE_RPM_LIMIT", "LUMIS_DICE_FOUNDRY_HOSTNAME", "LUMIS_DICE_FOUNDRY_PROTOCOL", "LUMIS_DICE_API_ROUTE_FAMILY"])) stop(STOP.control);
  exact(control.kill_switch, ["name", "required_value"], STOP.control);
  exact(control.traffic_switch, ["name", "required_value"], STOP.control);
  if (control.kill_switch.name !== "LUMIS_DICE_AI_ENABLED" || control.kill_switch.required_value !== false || control.traffic_switch.name !== "LUMIS_DICE_TRAFFIC_AUTHORIZED" || control.traffic_switch.required_value !== false || control.provider_calls_authorized !== 0 || control.model_invocations_authorized !== 0) stop(STOP.control);
  if (!sameArray(control.disabled_probes, ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"])) stop(STOP.control);
  exact(control.migration_boundary, ["path", "sha256", "application_authorized", "required_authorization_scope"], STOP.control);
  if (!SHA.test(control.migration_boundary.sha256) || control.migration_boundary.application_authorized !== false || control.migration_boundary.required_authorization_scope !== "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY") stop(STOP.migration);
  exact(control.normal_chat_binding, ["base_commit", "entry_path", "entry_blob", "current_sha256"], STOP.control);
  if (control.normal_chat_binding.entry_path !== "supabase/functions/chat-message/index.ts" || !SHA.test(control.normal_chat_binding.current_sha256)) stop(STOP.control);
  exact(control.authorization, ["schema", "maximum_age_minutes", "single_use_claim_schema", "signature_algorithm", "signing_key_sha256_required"], STOP.control);
  if (control.authorization.schema !== "lumis_dice_default_off_function_deployment_authorization_v4" || control.authorization.maximum_age_minutes !== 15 || control.authorization.single_use_claim_schema !== "s2_t277_dice_deployment_claim_v1" || control.authorization.signature_algorithm !== "Ed25519" || control.authorization.signing_key_sha256_required !== true) stop(STOP.control);
  exact(control.rollback, ["target", "previous_revision_required"], STOP.control);
  if (control.rollback.target !== "REMOVE_OR_RESTORE_DICE_SYNTHETIC_ONLY_KEEP_PROVIDER_DISABLED" || control.rollback.previous_revision_required !== true) stop(STOP.control);
  if (control.remote_calls_in_default_mode !== 0 || control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export async function verifyPinnedSources(control, root = process.cwd()) {
  validateControl(control);
  const canonical = [];
  for (const [name, binding] of Object.entries(control.bindings)) {
    let bytes;
    try { bytes = await readFile(`${root}/${binding.path}`); } catch { stop(STOP.source); }
    const digest = sha256(bytes);
    if (digest !== binding.sha256) stop(STOP.source);
    canonical.push(`${name}:${binding.path}:${digest}`);
  }
  if (sha256(`${canonical.sort().join("\n")}\n`) !== control.runtime_package_sha256) stop(STOP.package);
  let migration;
  try { migration = await readFile(`${root}/${control.migration_boundary.path}`); } catch { stop(STOP.source); }
  if (sha256(migration) !== control.migration_boundary.sha256) stop(STOP.source);
  let normalChat;
  try { normalChat = await readFile(`${root}/${control.normal_chat_binding.entry_path}`); } catch { stop(STOP.source); }
  if (sha256(normalChat) !== control.normal_chat_binding.current_sha256) stop(STOP.source);
  return true;
}

export function createAuthorizationRequest(control, requestId, issuedAt, validUntil, signingKeySha256) {
  validateControl(control);
  if (!/^dice-auth-request-[a-z0-9]{16,40}$/u.test(requestId) || !SHA.test(signingKeySha256)) stop(STOP.authorizationShape);
  const request = {
    schema: "s2_t277_dice_default_off_deployment_authorization_request_v1",
    authorization_scope: SCOPE,
    request_id: requestId,
    project_ref: PROJECT_REF,
    function_name: FUNCTION_NAME,
    issued_at: issuedAt,
    valid_until: validUntil,
    source_commit: control.source_commit,
    source_tree: control.source_tree,
    runtime_package_sha256: control.runtime_package_sha256,
    bindings: Object.fromEntries(Object.entries(control.bindings).map(([name, binding]) => [name, binding.sha256])),
    microsoft_signing_key_sha256: signingKeySha256,
    configuration_names: control.configuration_names,
    kill_switch_required: false,
    traffic_switch_required: false,
    provider_calls_authorized: 0,
    model_invocations_authorized: 0,
    disabled_probes: control.disabled_probes,
    migration_application_authorized: false,
    migration_required_authorization_scope: control.migration_boundary.required_authorization_scope,
    normal_chat_binding: control.normal_chat_binding,
    rollback_target: control.rollback.target,
    rollback_revision_required: true,
  };
  return Object.freeze({ ...request, request_sha256: sha256(`${JSON.stringify(request)}\n`) });
}

export function validateAuthorizationRequest(request, control) {
  exact(request, ["schema", "authorization_scope", "request_id", "project_ref", "function_name", "issued_at", "valid_until", "source_commit", "source_tree", "runtime_package_sha256", "bindings", "microsoft_signing_key_sha256", "configuration_names", "kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "disabled_probes", "migration_application_authorized", "migration_required_authorization_scope", "normal_chat_binding", "rollback_target", "rollback_revision_required", "request_sha256"], STOP.authorizationShape);
  const rebuilt = createAuthorizationRequest(control, request.request_id, request.issued_at, request.valid_until, request.microsoft_signing_key_sha256);
  if (JSON.stringify(request) !== JSON.stringify(rebuilt)) stop(STOP.authorizationShape);
  return request;
}

export function validateAuthorizationReceipt(receipt, control, request, microsoftPublicKeyPem, now = Date.now()) {
  validateAuthorizationRequest(request, control);
  exact(receipt, ["schema", "issuer", "decision", "authorization_scope", "request_id", "request_sha256", "project_ref", "function_name", "single_use_deployment_id", "issued_at", "valid_until", "source_commit", "source_tree", "runtime_package_sha256", "bindings", "microsoft_signing_key_sha256", "configuration_names", "kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "disabled_probes", "migration_application_authorized", "migration_required_authorization_scope", "normal_chat_binding", "rollback_target", "rollback_revision", "signature_algorithm", "microsoft_signature_base64"], STOP.authorizationShape);
  if (receipt.schema !== control.authorization.schema || receipt.issuer !== "Microsoft" || receipt.decision !== "AUTHORIZED" || receipt.authorization_scope !== SCOPE) stop(STOP.authorizationShape);
  if (receipt.project_ref !== PROJECT_REF) stop(STOP.project);
  if (receipt.function_name !== FUNCTION_NAME) stop(STOP.function);
  if (!DEPLOYMENT_ID.test(receipt.single_use_deployment_id) || receipt.request_id !== request.request_id || receipt.request_sha256 !== request.request_sha256) stop(STOP.authorizationShape);
  if (receipt.source_commit !== control.source_commit || receipt.source_tree !== control.source_tree || receipt.runtime_package_sha256 !== control.runtime_package_sha256) stop(STOP.package);
  const expectedBindings = Object.fromEntries(Object.entries(control.bindings).map(([name, binding]) => [name, binding.sha256]));
  if (JSON.stringify(receipt.bindings) !== JSON.stringify(expectedBindings) || !sameArray(receipt.configuration_names, control.configuration_names)) stop(STOP.package);
  if (receipt.kill_switch_required !== false || receipt.traffic_switch_required !== false || receipt.provider_calls_authorized !== 0 || receipt.model_invocations_authorized !== 0 || !sameArray(receipt.disabled_probes, control.disabled_probes) || receipt.migration_application_authorized !== false || receipt.migration_required_authorization_scope !== control.migration_boundary.required_authorization_scope) stop(STOP.authorizationShape);
  if (JSON.stringify(receipt.normal_chat_binding) !== JSON.stringify(control.normal_chat_binding) || receipt.rollback_target !== control.rollback.target || !REVISION.test(receipt.rollback_revision)) stop(STOP.authorizationShape);
  const issued = Date.parse(receipt.issued_at);
  const valid = Date.parse(receipt.valid_until);
  if (!Number.isFinite(issued) || !Number.isFinite(valid) || issued > now + 300_000 || valid <= now || valid - issued > control.authorization.maximum_age_minutes * 60_000) stop(STOP.authorizationStale);
  if (receipt.signature_algorithm !== "Ed25519" || typeof microsoftPublicKeyPem !== "string" || typeof receipt.microsoft_signature_base64 !== "string") stop(STOP.signature);
  let publicKey;
  try { publicKey = createPublicKey(microsoftPublicKeyPem); } catch { stop(STOP.signature); }
  const publicKeyDigest = sha256(publicKey.export({ type: "spki", format: "der" }));
  if (publicKeyDigest !== request.microsoft_signing_key_sha256 || receipt.microsoft_signing_key_sha256 !== publicKeyDigest) stop(STOP.signature);
  const signature = Buffer.from(receipt.microsoft_signature_base64, "base64");
  if (signature.length !== 64 || !verify(null, unsignedReceiptBytes(receipt), publicKey, signature)) stop(STOP.signature);
  return Object.freeze({ deploymentId: receipt.single_use_deployment_id, authorizationSha256: sha256(`${JSON.stringify(receipt)}\n`), rollbackRevision: receipt.rollback_revision });
}

export async function claimAuthorization(authorization, ledgerPath) {
  if (!authorization || !DEPLOYMENT_ID.test(authorization.deploymentId) || !SHA.test(authorization.authorizationSha256) || !REVISION.test(authorization.rollbackRevision)) stop(STOP.claim);
  await mkdir(dirname(ledgerPath), { recursive: true, mode: 0o700 });
  const claimPath = `${ledgerPath}.${authorization.deploymentId}`;
  let handle;
  try { handle = await open(claimPath, "wx", 0o600); } catch (error) {
    if (error?.code === "EEXIST") stop(STOP.replay);
    stop(STOP.claim);
  }
  try {
    await handle.writeFile(`${JSON.stringify({ schema: "s2_t277_dice_deployment_claim_v1", deployment_id: authorization.deploymentId, authorization_sha256: authorization.authorizationSha256, rollback_revision: authorization.rollbackRevision, consumed_once: true })}\n`, { encoding: "utf8" });
  } finally { await handle.close(); }
  return Object.freeze({ status: "CLAIMED", deploymentId: authorization.deploymentId });
}

export function validatePostDeployReceipt(receipt, authorization, control) {
  exact(receipt, ["schema", "project_ref", "function_name", "deployment_id", "authorization_sha256", "source_commit", "runtime_package_sha256", "configuration_names_verified", "kill_switch_disabled", "traffic_switch_disabled", "function_version", "rollback_revision", "disabled_probes", "provider_calls", "model_invocations", "normal_chat_unchanged", "migration_applied", "rollback_target", "deployed_at", "credentials_unset"], STOP.receipt);
  if (receipt.schema !== "s2_t277_dice_default_off_deployment_receipt_v1" || receipt.project_ref !== PROJECT_REF || receipt.function_name !== FUNCTION_NAME || receipt.deployment_id !== authorization.deploymentId || receipt.authorization_sha256 !== authorization.authorizationSha256 || receipt.source_commit !== control.source_commit || receipt.runtime_package_sha256 !== control.runtime_package_sha256) stop(STOP.receipt);
  if (receipt.configuration_names_verified !== true || receipt.kill_switch_disabled !== true || receipt.traffic_switch_disabled !== true || !Number.isInteger(receipt.function_version) || receipt.function_version < 1 || receipt.rollback_revision !== authorization.rollbackRevision || receipt.provider_calls !== 0 || receipt.model_invocations !== 0 || receipt.normal_chat_unchanged !== true || receipt.migration_applied !== false || receipt.rollback_target !== control.rollback.target || receipt.credentials_unset !== true || !Number.isFinite(Date.parse(receipt.deployed_at))) stop(STOP.receipt);
  exact(receipt.disabled_probes, control.disabled_probes, STOP.probe);
  if (control.disabled_probes.some((probe) => receipt.disabled_probes[probe] !== DISABLED)) stop(STOP.probe);
  return receipt;
}

export function validateRollbackReceipt(receipt, authorization, control) {
  exact(receipt, ["schema", "project_ref", "function_name", "deployment_id", "function_disabled", "function_removed_or_previous_restored", "restored_revision", "migration_0039_unchanged", "provider_calls", "model_invocations", "normal_chat_unchanged", "credentials_unset"], STOP.rollback);
  if (receipt.schema !== "s2_t277_dice_rollback_receipt_v1" || receipt.project_ref !== PROJECT_REF || receipt.function_name !== FUNCTION_NAME || receipt.deployment_id !== authorization.deploymentId || receipt.function_disabled !== true || receipt.function_removed_or_previous_restored !== true || receipt.restored_revision !== authorization.rollbackRevision || receipt.migration_0039_unchanged !== true || receipt.provider_calls !== 0 || receipt.model_invocations !== 0 || receipt.normal_chat_unchanged !== true || receipt.credentials_unset !== true || control.migration_boundary.application_authorized !== false) stop(STOP.rollback);
  return receipt;
}

export function nextGate({ authorization, claim, deployed, rollback } = {}) {
  if (!authorization) return "OBTAIN_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION";
  if (!claim) return "CONSUME_SINGLE_USE_DEPLOYMENT_CLAIM";
  if (!deployed) return "DEPLOY_DICE_SYNTHETIC_DEFAULT_OFF_ONLY";
  if (!rollback) return "RECORD_POST_DEPLOY_OR_ROLLBACK_RECEIPT";
  return "DEFAULT_OFF_DEPLOYMENT_RECORDED_NO_TRAFFIC_AUTHORITY";
}
