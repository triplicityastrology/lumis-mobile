import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  validateAuthorizationReceipt,
  validateAuthorizationRequest,
  validateControl as validateT287Control,
  validatePackageSeal as validateT287Seal,
  validatePostDeployReceipt as validateT287PostDeployReceipt,
  verifyAuthorizationPackage,
  verifyPinnedSources,
} from "./s2-t287-dice-v4-deployment-authorization.mjs";
import { validateDecisionControl, validateDecisionSeal, verifyDecisionSeal } from "./s2-t292-dice-v4-decision-packet.mjs";

export const NEXT_DECISION = "AUTHORIZE_DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY";
export const WAITING = "WAITING_FOR_SEPARATE_MICROSOFT_V4_DEPLOYMENT_AUTHORIZATION";
export const STOP = Object.freeze({
  control: "STOP_S2_T298_CONTROL_INVALID",
  seal: "STOP_S2_T298_PACKAGE_DRIFT",
  git: "STOP_S2_T298_GIT_IDENTITY_INVALID",
  dirty: "STOP_S2_T298_WORKTREE_NOT_CLEAN",
  receipt: "STOP_S2_T298_POST_DEPLOY_RECEIPT_INVALID",
  authorization: "STOP_S2_T298_SEPARATE_AUTHORIZATION_REQUIRED",
});

export class T298Stop extends Error {
  constructor(code) { super(code); this.name = "T298Stop"; this.code = code; }
}

const stop = (code) => { throw new T298Stop(code); };
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameArray = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const configurationNames = [
  "LUMIS_DICE_AI_ENABLED", "LUMIS_DICE_TRAFFIC_AUTHORIZED", "LUMIS_DICE_AZURE_API_KEY",
  "LUMIS_DICE_AUTHORITY_HMAC_SECRET", "LUMIS_DICE_DEPLOYMENT_ALIAS", "LUMIS_DICE_MODEL",
  "LUMIS_DICE_MODEL_VERSION", "LUMIS_DICE_DEPLOYMENT_TYPE", "LUMIS_DICE_UPGRADE_POLICY",
  "LUMIS_DICE_GUARDRAIL", "LUMIS_DICE_TPM_LIMIT", "LUMIS_DICE_RPM_LIMIT",
  "LUMIS_DICE_FOUNDRY_HOSTNAME", "LUMIS_DICE_FOUNDRY_PROTOCOL", "LUMIS_DICE_API_ROUTE_FAMILY",
];
const probeNames = ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"];

export function validateControl(control) {
  exact(control, ["schema", "status", "next_decision", "authorization_scope", "project_ref", "function_name", "base_commit", "canonical_deployment_commit", "runtime_package_sha256", "authorization_package_sha256", "authorization_schema", "authorization_window_seconds", "clock_policy", "signature_algorithm", "single_use", "protected_dice_product_sources", "configuration_names", "disabled_probes", "expected_disabled_result", "post_deploy", "rollback_target", "remote_calls_in_preflight", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t298_dice_v4_zero_call_control_v1" || control.status !== WAITING || control.next_decision !== NEXT_DECISION) stop(STOP.control);
  if (control.authorization_scope !== "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" || control.project_ref !== "bmqhwofmdgebpcihjlnb" || control.function_name !== "dice-synthetic") stop(STOP.control);
  if (control.base_commit !== "f1288d6159d23317f6f4db05bcf194bc93af65d6" || control.canonical_deployment_commit !== "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432") stop(STOP.control);
  if (control.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || control.authorization_package_sha256 !== "53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799") stop(STOP.control);
  if (control.authorization_schema !== "lumis_dice_default_off_function_deployment_authorization_v4" || control.authorization_window_seconds !== 900 || control.clock_policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW" || control.signature_algorithm !== "Ed25519" || control.single_use !== true) stop(STOP.control);
  exact(control.protected_dice_product_sources, ["apps/mobile/src/features/dice/DiceRitualScreen.tsx", "apps/mobile/src/screens/LumisDiceScreen.tsx"], STOP.control);
  if (Object.values(control.protected_dice_product_sources).some((digest) => !SHA256.test(digest))) stop(STOP.control);
  if (!sameArray(control.configuration_names, configurationNames) || !sameArray(control.disabled_probes, probeNames) || control.expected_disabled_result !== "DICE_AI_DISABLED") stop(STOP.control);
  exact(control.post_deploy, ["schema", "kill_switch_value", "traffic_switch_value", "provider_calls", "model_invocations", "migration_0039_applied", "normal_chat_unchanged", "credentials_unset"], STOP.control);
  if (control.post_deploy.schema !== "s2_t298_dice_v4_zero_call_post_deploy_receipt_v1" || control.post_deploy.kill_switch_value !== false || control.post_deploy.traffic_switch_value !== false || control.post_deploy.provider_calls !== 0 || control.post_deploy.model_invocations !== 0 || control.post_deploy.migration_0039_applied !== false || control.post_deploy.normal_chat_unchanged !== true || control.post_deploy.credentials_unset !== true) stop(STOP.control);
  if (control.rollback_target !== "REMOVE_OR_RESTORE_DICE_SYNTHETIC_ONLY_KEEP_PROVIDER_DISABLED" || control.remote_calls_in_preflight !== 0 || control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export function validateSeal(seal) {
  exact(seal, ["schema", "base_commit", "runtime_package_sha256", "authorization_package_sha256", "package_sha256", "files"], STOP.seal);
  if (seal.schema !== "s2_t298_dice_v4_zero_call_package_seal_v1" || seal.base_commit !== "f1288d6159d23317f6f4db05bcf194bc93af65d6" || seal.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || seal.authorization_package_sha256 !== "53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799" || !SHA256.test(seal.package_sha256)) stop(STOP.seal);
  if (!isRecord(seal.files) || Object.keys(seal.files).length < 8 || Object.values(seal.files).some((digest) => !SHA256.test(digest))) stop(STOP.seal);
  const canonical = Object.entries(seal.files).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
  if (sha256(`${canonical}\n`) !== seal.package_sha256) stop(STOP.seal);
  return seal;
}

export async function verifySeal(seal, root = process.cwd()) {
  validateSeal(seal);
  for (const [path, expected] of Object.entries(seal.files)) {
    const bytes = await readFile(`${root}/${path}`).catch(() => stop(STOP.seal));
    if (sha256(bytes) !== expected) stop(STOP.seal);
  }
  return true;
}

export function gitIdentity(root = process.cwd(), allowUntracked = false) {
  const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const identity = { source_commit: run(["rev-parse", "HEAD"]), source_tree: run(["rev-parse", "HEAD^{tree}"]), clean: run(["status", "--porcelain", ...(allowUntracked ? ["--untracked-files=no"] : [])]) === "" };
  if (!COMMIT.test(identity.source_commit) || !COMMIT.test(identity.source_tree)) stop(STOP.git);
  if (!identity.clean) stop(STOP.dirty);
  return identity;
}

export async function verifyOfflinePreflight(root = process.cwd(), { allowUntracked = false } = {}) {
  const readJson = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
  const control = validateControl(await readJson("config/s2-t298-dice-v4-zero-call-control.json"));
  const seal = validateSeal(await readJson("config/s2-t298-dice-v4-zero-call-package-seal.json"));
  const t287Control = validateT287Control(await readJson("config/s2-t287-dice-v4-deployment-control.json"));
  const t287Seal = validateT287Seal(await readJson("config/s2-t287-dice-v4-deployment-package-seal.json"));
  validateDecisionControl(await readJson("config/s2-t292-dice-v4-decision-control.json"));
  const t292Seal = validateDecisionSeal(await readJson("config/s2-t292-dice-v4-decision-package-seal.json"));
  await verifyPinnedSources(t287Control, root);
  await verifyAuthorizationPackage(t287Seal, root);
  await verifyDecisionSeal(t292Seal, root);
  await verifySeal(seal, root);
  for (const [path, expected] of Object.entries(control.protected_dice_product_sources)) {
    const bytes = await readFile(`${root}/${path}`).catch(() => stop(STOP.seal));
    if (sha256(bytes) !== expected) stop(STOP.seal);
  }
  if (control.runtime_package_sha256 !== t287Control.runtime_package_sha256 || control.authorization_package_sha256 !== t287Seal.authorization_package_sha256) stop(STOP.seal);
  return { control, seal, t287Control, t287Seal, identity: gitIdentity(root, allowUntracked) };
}

export function validatePostDeployReceipt(receipt, legacyReceipt, authorization, control, t287Control, t287Seal) {
  validateT287PostDeployReceipt(legacyReceipt, authorization, t287Control, t287Seal);
  exact(receipt, ["schema", "project_ref", "function_name", "deployment_id", "authorization_sha256", "request_sha256", "signing_key_sha256", "source_commit", "source_tree", "runtime_package_sha256", "authorization_package_sha256", "configuration_names", "kill_switch_value", "traffic_switch_value", "function_version", "rollback_revision", "disabled_probes", "provider_calls", "model_invocations", "normal_chat_unchanged", "migration_0039_applied", "rollback_target", "deployed_at", "credentials_unset", "legacy_receipt_sha256"], STOP.receipt);
  if (receipt.schema !== control.post_deploy.schema || receipt.project_ref !== control.project_ref || receipt.function_name !== control.function_name || receipt.deployment_id !== authorization.deploymentId || receipt.authorization_sha256 !== authorization.authorizationSha256 || receipt.source_commit !== authorization.sourceCommit || receipt.source_tree !== authorization.sourceTree) stop(STOP.receipt);
  if (receipt.runtime_package_sha256 !== control.runtime_package_sha256 || receipt.authorization_package_sha256 !== control.authorization_package_sha256 || !sameArray(receipt.configuration_names, control.configuration_names)) stop(STOP.receipt);
  if (receipt.kill_switch_value !== false || receipt.traffic_switch_value !== false || receipt.provider_calls !== 0 || receipt.model_invocations !== 0 || receipt.normal_chat_unchanged !== true || receipt.migration_0039_applied !== false || receipt.rollback_target !== control.rollback_target || receipt.credentials_unset !== true) stop(STOP.receipt);
  if (!Number.isInteger(receipt.function_version) || receipt.function_version < 1 || typeof receipt.rollback_revision !== "string" || !Number.isFinite(Date.parse(receipt.deployed_at)) || receipt.legacy_receipt_sha256 !== sha256(`${JSON.stringify(legacyReceipt)}\n`)) stop(STOP.receipt);
  exact(receipt.disabled_probes, probeNames, STOP.receipt);
  if (probeNames.some((probe) => receipt.disabled_probes[probe] !== "DICE_AI_DISABLED")) stop(STOP.receipt);
  return receipt;
}

export async function validateExecutionAuthorization({ request, receipt, publicKeyPem, now = Date.now(), root = process.cwd() }) {
  const ready = await verifyOfflinePreflight(root);
  validateAuthorizationRequest(request, ready.t287Control, ready.t287Seal, ready.identity);
  return { ...ready, authorization: validateAuthorizationReceipt(receipt, ready.t287Control, ready.t287Seal, request, ready.identity, publicKeyPem, now) };
}
