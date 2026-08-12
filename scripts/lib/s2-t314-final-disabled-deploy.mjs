import { createHash, createPublicKey, verify } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export const SCOPE = "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY";
export const ISSUER = "Lumis Founder Deployment Approver";
export const TRUST_ANCHOR_OWNER = "Founder";
export const ISSUER_KEY_ID = "founder-ed25519-deployment-approver-v1";
export const ISSUER_PUBLIC_KEY_SPKI_SHA256 = "ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478";
export const TRUST_ANCHOR_AUTHORITY_COMMIT = "523a4166f18ecdac66a30b03d6f59068bd5b7279";
export const WAITING = "WAITING_FOR_LUMIS_FOUNDER_SIGNED_DEFAULT_OFF_RECEIPT";
export const NEXT_ACTION = "OBTAIN_LUMIS_FOUNDER_SIGNED_DEFAULT_OFF_DEPLOYMENT_RECEIPT";
export const PROJECT_REF = "bmqhwofmdgebpcihjlnb";
export const FUNCTION_NAME = "dice-synthetic";
export const PROBES = Object.freeze(["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"]);

export const STOP = Object.freeze({
  control: "STOP_S2_T314_CONTROL_INVALID",
  package: "STOP_S2_T314_PACKAGE_DRIFT",
  dirty: "STOP_S2_T314_WORKTREE_NOT_CLEAN",
  request: "STOP_S2_T314_REQUEST_INVALID",
  receipt: "STOP_S2_T314_FOUNDER_RECEIPT_INVALID",
  signature: "STOP_S2_T314_FOUNDER_SIGNATURE_INVALID",
  stale: "STOP_S2_T314_FOUNDER_RECEIPT_STALE",
  replay: "STOP_S2_T314_FOUNDER_RECEIPT_REPLAYED",
  project: "STOP_S2_T314_WRONG_PROJECT",
  function: "STOP_S2_T314_WRONG_FUNCTION",
  migration: "STOP_S2_T314_MIGRATION_0039_EXCLUDED",
  traffic: "STOP_S2_T314_TRAFFIC_EXCLUDED",
  switches: "STOP_S2_T314_DISABLED_SWITCHES_REQUIRED",
  rollback: "STOP_S2_T314_ROLLBACK_REVISION_REQUIRED",
  claim: "STOP_S2_T314_SINGLE_USE_CLAIM_FAILED",
  registry: "STOP_S2_T314_FOUNDER_REGISTRY_DRIFT",
  postReceipt: "STOP_S2_T314_POST_DEPLOY_RECEIPT_INVALID",
});

export class T314Stop extends Error {
  constructor(code) { super(code); this.name = "T314Stop"; this.code = code; }
}

const stop = (code) => { throw new T314Stop(code); };
const SHA256 = /^[a-f0-9]{64}$/u;
const GIT = /^[a-f0-9]{40}$/u;
const REQUEST_ID = /^dice-founder-deploy-request-[a-z0-9]{16,40}$/u;
const DEPLOYMENT_ID = /^dice-founder-deploy-[a-z0-9]{16,40}$/u;
const REVISION = /^(?:absent|version-[0-9]+)$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameArray = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => `${JSON.stringify(value)}\n`;
const unsignedReceipt = (receipt) => Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "issuer_signature_base64"));

export function validateControl(control) {
  exact(control, ["schema", "status", "authorization_scope", "project_ref", "function_name", "source_authority", "founder_registry", "issuer", "authorization", "configuration_names", "required_disabled_values", "disabled_probes", "expected_disabled_result", "provider_calls_authorized", "model_invocations_authorized", "migration_0039_authorized", "rollback", "pre_receipt_boundary", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t314_final_disabled_deploy_control_v1" || control.status !== WAITING || control.authorization_scope !== SCOPE || control.project_ref !== PROJECT_REF || control.function_name !== FUNCTION_NAME) stop(STOP.control);
  exact(control.source_authority, ["t307_commit", "t307_package_sha256", "runtime_package_sha256"], STOP.control);
  if (control.source_authority.t307_commit !== "cf8386a9176ed7fde0b6008a2628c2785bce2c64" || !SHA256.test(control.source_authority.t307_package_sha256) || control.source_authority.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457") stop(STOP.control);
  exact(control.founder_registry, ["path", "registry_payload_sha256", "fixture_total", "english", "zh_hant", "excluded_authoring_id"], STOP.registry);
  if (control.founder_registry.path !== "config/s2-t314-founder-fixture-registry.json" || !SHA256.test(control.founder_registry.registry_payload_sha256) || control.founder_registry.fixture_total !== 40 || control.founder_registry.english !== 20 || control.founder_registry.zh_hant !== 20 || control.founder_registry.excluded_authoring_id !== "ZH04") stop(STOP.registry);
  exact(control.issuer, ["name", "trust_anchor_owner", "signature_algorithm", "trust_anchor_authority_commit", "issuer_key_id", "issuer_public_key_spki_sha256", "custody_classification", "private_key_committed"], STOP.control);
  if (control.issuer.name !== ISSUER || control.issuer.trust_anchor_owner !== TRUST_ANCHOR_OWNER || control.issuer.signature_algorithm !== "Ed25519" || control.issuer.trust_anchor_authority_commit !== TRUST_ANCHOR_AUTHORITY_COMMIT || control.issuer.issuer_key_id !== ISSUER_KEY_ID || control.issuer.issuer_public_key_spki_sha256 !== ISSUER_PUBLIC_KEY_SPKI_SHA256 || control.issuer.custody_classification !== "LOCAL_NON_CLOUD_OWNER_ONLY" || control.issuer.private_key_committed !== false) stop(STOP.control);
  exact(control.authorization, ["request_schema", "receipt_schema", "window_seconds", "clock_policy", "single_use", "durable_claim_before_remote"], STOP.control);
  if (control.authorization.request_schema !== "lumis_founder_dice_default_off_deployment_request_v1" || control.authorization.receipt_schema !== "lumis_founder_dice_default_off_deployment_authorization_v1" || control.authorization.window_seconds !== 900 || control.authorization.clock_policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW" || control.authorization.single_use !== true || control.authorization.durable_claim_before_remote !== true) stop(STOP.control);
  if (!Array.isArray(control.configuration_names) || control.configuration_names.length !== 15 || new Set(control.configuration_names).size !== 15) stop(STOP.control);
  exact(control.required_disabled_values, ["LUMIS_DICE_AI_ENABLED", "LUMIS_DICE_TRAFFIC_AUTHORIZED"], STOP.switches);
  if (control.required_disabled_values.LUMIS_DICE_AI_ENABLED !== false || control.required_disabled_values.LUMIS_DICE_TRAFFIC_AUTHORIZED !== false || !sameArray(control.disabled_probes, PROBES) || control.expected_disabled_result !== "DICE_AI_DISABLED") stop(STOP.switches);
  if (control.provider_calls_authorized !== 0 || control.model_invocations_authorized !== 0) stop(STOP.traffic);
  if (control.migration_0039_authorized !== false) stop(STOP.migration);
  exact(control.rollback, ["target", "previous_revision_required", "automatic_on_failure"], STOP.rollback);
  if (control.rollback.target !== "REMOVE_OR_RESTORE_DICE_SYNTHETIC_ONLY_KEEP_PROVIDER_DISABLED" || control.rollback.previous_revision_required !== true || control.rollback.automatic_on_failure !== true) stop(STOP.rollback);
  exact(control.pre_receipt_boundary, ["cli_construction", "client_construction", "credential_reads", "remote_calls", "receipt_writes"], STOP.control);
  if (Object.values(control.pre_receipt_boundary).some((value) => value !== 0)) stop(STOP.control);
  if (control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export function validateRegistry(registry, control) {
  exact(registry, ["schema", "source_path", "source_sha256", "excluded_authoring_id", "excluded_exact_text_sha256", "fixture_total", "language_totals", "runtime_request_fields", "fixtures", "registry_payload_sha256"], STOP.registry);
  const payload = Object.fromEntries(Object.entries(registry).filter(([key]) => key !== "registry_payload_sha256"));
  if (registry.schema !== "s2_t314_closed_founder_fixture_registry_v1" || sha256(canonical(payload)) !== registry.registry_payload_sha256 || registry.registry_payload_sha256 !== control.founder_registry.registry_payload_sha256) stop(STOP.registry);
  if (registry.fixture_total !== 40 || registry.fixtures.length !== 40 || registry.language_totals.en !== 20 || registry.language_totals["zh-Hant"] !== 20 || registry.excluded_authoring_id !== "ZH04" || !sameArray(registry.runtime_request_fields, ["fixture_id"])) stop(STOP.registry);
  const ids = new Set();
  for (const fixture of registry.fixtures) {
    exact(fixture, ["authoring_id", "fixture_id", "language", "exact_text", "exact_text_sha256"], STOP.registry);
    if (fixture.authoring_id === "ZH04" || ids.has(fixture.fixture_id) || sha256(fixture.exact_text) !== fixture.exact_text_sha256) stop(STOP.registry);
    ids.add(fixture.fixture_id);
  }
  const expectedIds = [
    ...Array.from({ length: 20 }, (_, index) => `dice-founder-en-${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 20 }, (_, index) => `dice-founder-zh-${String(index + 1).padStart(2, "0")}`),
  ];
  if (expectedIds.some((id) => !ids.has(id)) || ids.size !== expectedIds.length) stop(STOP.registry);
  if (!registry.fixtures.some((item) => item.authoring_id === "ZH08") || !registry.fixtures.some((item) => item.authoring_id === "ZH09")) stop(STOP.registry);
  return registry;
}

export function validateSeal(seal) {
  exact(seal, ["schema", "base_commit", "package_sha256", "files"], STOP.package);
  if (seal.schema !== "s2_t314_final_disabled_deploy_package_seal_v1" || seal.base_commit !== "cf8386a9176ed7fde0b6008a2628c2785bce2c64" || !SHA256.test(seal.package_sha256) || !isRecord(seal.files) || Object.keys(seal.files).length < 12) stop(STOP.package);
  if (Object.values(seal.files).some((digest) => !SHA256.test(digest))) stop(STOP.package);
  const lines = Object.entries(seal.files).sort(([a], [b]) => a.localeCompare(b)).map(([path, digest]) => `${path}:${digest}`).join("\n");
  if (sha256(`${lines}\n`) !== seal.package_sha256) stop(STOP.package);
  return seal;
}

export async function verifyPackage(root = process.cwd(), { requireClean = true } = {}) {
  const json = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
  const control = validateControl(await json("config/s2-t314-final-disabled-deploy-control.json"));
  const registry = validateRegistry(await json(control.founder_registry.path), control);
  const seal = validateSeal(await json("config/s2-t314-final-disabled-deploy-package-seal.json"));
  for (const [path, expected] of Object.entries(seal.files)) {
    const bytes = await readFile(`${root}/${path}`).catch(() => stop(STOP.package));
    if (sha256(bytes) !== expected) stop(STOP.package);
  }
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try { execFileSync("git", ["merge-base", "--is-ancestor", control.source_authority.t307_commit, "HEAD"], { cwd: root, stdio: "ignore" }); } catch { stop(STOP.package); }
  const identity = { source_commit: git(["rev-parse", "HEAD"]), source_tree: git(["rev-parse", "HEAD^{tree}"]) };
  if (!GIT.test(identity.source_commit) || !GIT.test(identity.source_tree)) stop(STOP.package);
  if (requireClean && git(["status", "--porcelain"]) !== "") stop(STOP.dirty);
  return { control, registry, seal, identity };
}

export function createRequest(ready, { requestId, issuerKeyId, publicKeyPem }) {
  if (!REQUEST_ID.test(requestId) || issuerKeyId !== ISSUER_KEY_ID || typeof publicKeyPem !== "string") stop(STOP.request);
  const { fingerprint } = verifyPinnedFounderPublicKey(publicKeyPem);
  const request = {
    schema: ready.control.authorization.request_schema,
    authorization_scope: SCOPE,
    request_id: requestId,
    issuer: ISSUER,
    trust_anchor_owner: TRUST_ANCHOR_OWNER,
    issuer_key_id: issuerKeyId,
    issuer_public_key_spki_sha256: fingerprint,
    project_ref: PROJECT_REF,
    function_name: FUNCTION_NAME,
    source_commit: ready.identity.source_commit,
    source_tree: ready.identity.source_tree,
    package_sha256: ready.seal.package_sha256,
    runtime_package_sha256: ready.control.source_authority.runtime_package_sha256,
    founder_registry_sha256: ready.registry.registry_payload_sha256,
    configuration_names: ready.control.configuration_names,
    kill_switch_required: false,
    traffic_switch_required: false,
    provider_calls_authorized: 0,
    model_invocations_authorized: 0,
    disabled_probes: PROBES,
    migration_0039_authorized: false,
    rollback_target: ready.control.rollback.target,
    rollback_revision_required: true,
    authorization_window_seconds: 900,
    clock_policy: ready.control.authorization.clock_policy,
    normal_chat_unchanged_required: true,
  };
  return Object.freeze({ ...request, request_sha256: sha256(canonical(request)) });
}

export function validateRequest(request, ready, publicKeyPem) {
  exact(request, ["schema", "authorization_scope", "request_id", "issuer", "trust_anchor_owner", "issuer_key_id", "issuer_public_key_spki_sha256", "project_ref", "function_name", "source_commit", "source_tree", "package_sha256", "runtime_package_sha256", "founder_registry_sha256", "configuration_names", "kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "disabled_probes", "migration_0039_authorized", "rollback_target", "rollback_revision_required", "authorization_window_seconds", "clock_policy", "normal_chat_unchanged_required", "request_sha256"], STOP.request);
  const rebuilt = createRequest(ready, { requestId: request.request_id, issuerKeyId: request.issuer_key_id, publicKeyPem });
  if (JSON.stringify(request) !== JSON.stringify(rebuilt)) stop(STOP.request);
  return request;
}

export function validateReceipt(receipt, request, ready, publicKeyPem, now = Date.now()) {
  validateRequest(request, ready, publicKeyPem);
  exact(receipt, ["schema", "issuer", "trust_anchor_owner", "decision", "authorization_scope", "request_id", "request_sha256", "single_use_deployment_id", "issued_at", "authorization_window_seconds", "clock_policy", "project_ref", "function_name", "source_commit", "source_tree", "package_sha256", "runtime_package_sha256", "founder_registry_sha256", "issuer_key_id", "issuer_public_key_spki_sha256", "configuration_names", "kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "disabled_probes", "migration_0039_authorized", "normal_chat_unchanged_required", "rollback_target", "rollback_revision", "signature_algorithm", "issuer_signature_base64"], STOP.receipt);
  if (receipt.schema !== ready.control.authorization.receipt_schema || receipt.issuer !== ISSUER || receipt.trust_anchor_owner !== TRUST_ANCHOR_OWNER || receipt.decision !== "AUTHORIZED" || receipt.authorization_scope !== SCOPE) stop(STOP.receipt);
  if (receipt.project_ref !== PROJECT_REF) stop(STOP.project);
  if (receipt.function_name !== FUNCTION_NAME) stop(STOP.function);
  if (receipt.migration_0039_authorized !== false) stop(STOP.migration);
  if (receipt.traffic_switch_required !== false || receipt.provider_calls_authorized !== 0 || receipt.model_invocations_authorized !== 0) stop(STOP.traffic);
  if (receipt.kill_switch_required !== false) stop(STOP.switches);
  if (!REVISION.test(receipt.rollback_revision)) stop(STOP.rollback);
  if (!DEPLOYMENT_ID.test(receipt.single_use_deployment_id) || receipt.request_id !== request.request_id || receipt.request_sha256 !== request.request_sha256 || receipt.source_commit !== ready.identity.source_commit || receipt.source_tree !== ready.identity.source_tree || receipt.package_sha256 !== ready.seal.package_sha256 || receipt.runtime_package_sha256 !== ready.control.source_authority.runtime_package_sha256 || receipt.founder_registry_sha256 !== ready.registry.registry_payload_sha256) stop(STOP.receipt);
  if (receipt.issuer_key_id !== ISSUER_KEY_ID || receipt.issuer_key_id !== request.issuer_key_id || receipt.issuer_public_key_spki_sha256 !== ISSUER_PUBLIC_KEY_SPKI_SHA256 || receipt.issuer_public_key_spki_sha256 !== request.issuer_public_key_spki_sha256 || !sameArray(receipt.configuration_names, ready.control.configuration_names) || !sameArray(receipt.disabled_probes, PROBES) || receipt.normal_chat_unchanged_required !== true || receipt.rollback_target !== ready.control.rollback.target || receipt.authorization_window_seconds !== 900 || receipt.clock_policy !== ready.control.authorization.clock_policy || receipt.signature_algorithm !== "Ed25519") stop(STOP.receipt);
  const issued = Date.parse(receipt.issued_at);
  if (!Number.isFinite(issued) || issued > now + 300_000 || now - issued >= 900_000) stop(STOP.stale);
  const { key } = verifyPinnedFounderPublicKey(publicKeyPem);
  const signature = Buffer.from(receipt.issuer_signature_base64, "base64");
  if (signature.length !== 64 || !verify(null, Buffer.from(canonical(unsignedReceipt(receipt))), key, signature)) stop(STOP.signature);
  return Object.freeze({
    deploymentId: receipt.single_use_deployment_id,
    authorizationSha256: sha256(canonical(receipt)),
    requestSha256: request.request_sha256,
    rollbackRevision: receipt.rollback_revision,
    issuerKeyId: receipt.issuer_key_id,
    issuerPublicKeySpkiSha256: receipt.issuer_public_key_spki_sha256,
  });
}

export function verifyPinnedFounderPublicKey(publicKeyPem) {
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { stop(STOP.signature); }
  if (key.asymmetricKeyType !== "ed25519") stop(STOP.signature);
  const fingerprint = sha256(key.export({ type: "spki", format: "der" }));
  if (fingerprint !== ISSUER_PUBLIC_KEY_SPKI_SHA256) stop(STOP.signature);
  return Object.freeze({ key, fingerprint });
}

export function verifyDetachedEd25519ForTest({ publicKeyPem, expectedFingerprint, payload, signatureBase64 }) {
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { return false; }
  const fingerprint = sha256(key.export({ type: "spki", format: "der" }));
  const signature = Buffer.from(signatureBase64, "base64");
  return fingerprint === expectedFingerprint && signature.length === 64 && verify(null, Buffer.from(payload), key, signature);
}

export async function claimReceipt(authorization, ledgerPath) {
  if (!authorization || !DEPLOYMENT_ID.test(authorization.deploymentId) || !SHA256.test(authorization.authorizationSha256) || typeof ledgerPath !== "string" || ledgerPath.length === 0) stop(STOP.claim);
  await mkdir(dirname(ledgerPath), { recursive: true, mode: 0o700 });
  const path = `${ledgerPath}.${authorization.deploymentId}`;
  let handle;
  try { handle = await open(path, "wx", 0o600); } catch (error) {
    if (error?.code === "EEXIST") stop(STOP.replay);
    stop(STOP.claim);
  }
  try { await handle.writeFile(canonical({ schema: "s2_t314_founder_deployment_claim_v1", deployment_id: authorization.deploymentId, authorization_sha256: authorization.authorizationSha256, consumed_once: true })); }
  finally { await handle.close(); }
  return authorization;
}

export function validatePostReceipt(receipt, authorization, ready) {
  exact(receipt, ["schema", "project_ref", "function_name", "deployment_id", "authorization_sha256", "request_sha256", "issuer_key_id", "issuer_public_key_spki_sha256", "source_commit", "source_tree", "package_sha256", "runtime_package_sha256", "founder_registry_sha256", "kill_switch_disabled", "traffic_switch_disabled", "function_version", "rollback_revision", "disabled_probes", "provider_calls", "model_invocations", "normal_chat_unchanged", "migration_0039_applied", "rollback_target", "deployed_at", "credentials_unset"], STOP.postReceipt);
  if (receipt.schema !== "s2_t314_zero_call_post_deploy_receipt_v1" || receipt.project_ref !== PROJECT_REF || receipt.function_name !== FUNCTION_NAME || receipt.deployment_id !== authorization.deploymentId || receipt.authorization_sha256 !== authorization.authorizationSha256 || receipt.request_sha256 !== authorization.requestSha256 || receipt.issuer_key_id !== authorization.issuerKeyId || receipt.issuer_public_key_spki_sha256 !== authorization.issuerPublicKeySpkiSha256 || receipt.source_commit !== ready.identity.source_commit || receipt.source_tree !== ready.identity.source_tree || receipt.package_sha256 !== ready.seal.package_sha256 || receipt.runtime_package_sha256 !== ready.control.source_authority.runtime_package_sha256 || receipt.founder_registry_sha256 !== ready.registry.registry_payload_sha256) stop(STOP.postReceipt);
  if (receipt.kill_switch_disabled !== true || receipt.traffic_switch_disabled !== true || !Number.isInteger(receipt.function_version) || receipt.function_version < 1 || receipt.rollback_revision !== authorization.rollbackRevision || receipt.provider_calls !== 0 || receipt.model_invocations !== 0 || receipt.normal_chat_unchanged !== true || receipt.migration_0039_applied !== false || receipt.rollback_target !== ready.control.rollback.target || receipt.credentials_unset !== true || !Number.isFinite(Date.parse(receipt.deployed_at))) stop(STOP.postReceipt);
  exact(receipt.disabled_probes, PROBES, STOP.postReceipt);
  if (PROBES.some((name) => receipt.disabled_probes[name] !== "DICE_AI_DISABLED")) stop(STOP.postReceipt);
  return receipt;
}
