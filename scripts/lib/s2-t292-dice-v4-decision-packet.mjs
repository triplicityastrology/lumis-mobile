import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  createAuthorizationRequest,
  validateAuthorizationRequest,
  validateControl as validateT287Control,
  validatePackageSeal as validateT287Seal,
  verifyAuthorizationPackage,
  verifyPinnedSources,
} from "../lib/s2-t287-dice-v4-deployment-authorization.mjs";

export const NEXT_DECISION = "OBTAIN_LUMIS_FOUNDER_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION";
export const STOP = Object.freeze({
  control: "STOP_S2_T292_DECISION_CONTROL_INVALID",
  packet: "STOP_S2_T292_DECISION_PACKET_INVALID",
  package: "STOP_S2_T292_PACKAGE_DRIFT",
  git: "STOP_S2_T292_GIT_IDENTITY_INVALID",
  dirty: "STOP_S2_T292_WORKTREE_NOT_CLEAN",
});

export class DecisionStop extends Error {
  constructor(code) { super(code); this.name = "DecisionStop"; this.code = code; }
}

const stop = (code) => { throw new DecisionStop(code); };
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

export function validateDecisionControl(control) {
  exact(control, ["schema", "status", "next_decision", "authorization_scope", "project_ref", "function_name", "source_authority_commit", "source_authority_tree", "runtime_package_sha256", "authorization_package_sha256", "authorization_schema", "request_schema", "signature_algorithm", "authorization_window_seconds", "clock_policy", "single_use", "replay_rejected", "configuration_names", "disabled_probes", "expected_disabled_result", "rollback", "post_deploy", "migration_0039_authorized", "remote_calls_in_preflight", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t292_dice_v4_microsoft_decision_control_v1" || control.status !== "WAITING_FOR_LUMIS_FOUNDER_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION" || control.next_decision !== NEXT_DECISION) stop(STOP.control);
  if (control.authorization_scope !== "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" || control.project_ref !== "bmqhwofmdgebpcihjlnb" || control.function_name !== "dice-synthetic") stop(STOP.control);
  if (control.source_authority_commit !== "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432" || control.source_authority_tree !== "2baaaa57268edb211223e44056429924067908f6") stop(STOP.control);
  if (control.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || control.authorization_package_sha256 !== "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2") stop(STOP.control);
  if (control.authorization_schema !== "lumis_dice_default_off_function_deployment_authorization_v4" || control.request_schema !== "lumis_dice_default_off_function_deployment_authorization_request_v4" || control.signature_algorithm !== "Ed25519") stop(STOP.control);
  if (control.authorization_window_seconds !== 900 || control.clock_policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW" || control.single_use !== true || control.replay_rejected !== true) stop(STOP.control);
  if (!sameArray(control.configuration_names, configurationNames) || !sameArray(control.disabled_probes, probeNames) || control.expected_disabled_result !== "DICE_AI_DISABLED") stop(STOP.control);
  exact(control.rollback, ["target", "previous_revision_required", "receipt_schema"], STOP.control);
  if (control.rollback.target !== "REMOVE_OR_RESTORE_DICE_SYNTHETIC_ONLY_KEEP_PROVIDER_DISABLED" || control.rollback.previous_revision_required !== true || control.rollback.receipt_schema !== "s2_t287_dice_rollback_receipt_v1") stop(STOP.control);
  exact(control.post_deploy, ["receipt_schema", "provider_calls", "model_invocations", "migration_applied", "kill_switch_disabled", "traffic_switch_disabled"], STOP.control);
  if (control.post_deploy.receipt_schema !== "s2_t287_dice_default_off_deployment_receipt_v1" || control.post_deploy.provider_calls !== 0 || control.post_deploy.model_invocations !== 0 || control.post_deploy.migration_applied !== false || control.post_deploy.kill_switch_disabled !== true || control.post_deploy.traffic_switch_disabled !== true) stop(STOP.control);
  if (control.migration_0039_authorized !== false || control.remote_calls_in_preflight !== 0 || control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export function validateDecisionSeal(seal) {
  exact(seal, ["schema", "source_authority_commit", "runtime_package_sha256", "authorization_package_sha256", "decision_packet_sha256", "files"], STOP.package);
  if (seal.schema !== "s2_t292_dice_v4_microsoft_decision_package_seal_v1" || seal.source_authority_commit !== "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432" || seal.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || seal.authorization_package_sha256 !== "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2" || !SHA256.test(seal.decision_packet_sha256)) stop(STOP.package);
  if (!isRecord(seal.files) || Object.keys(seal.files).length < 6 || Object.values(seal.files).some((digest) => !SHA256.test(digest))) stop(STOP.package);
  const canonical = Object.entries(seal.files).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
  if (sha256(`${canonical}\n`) !== seal.decision_packet_sha256) stop(STOP.package);
  return seal;
}

export async function verifyDecisionSeal(seal, root = process.cwd()) {
  validateDecisionSeal(seal);
  for (const [path, expected] of Object.entries(seal.files)) {
    let bytes;
    try { bytes = await readFile(`${root}/${path}`); } catch { stop(STOP.package); }
    if (sha256(bytes) !== expected) stop(STOP.package);
  }
  return true;
}

export function gitIdentity(root = process.cwd()) {
  const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const identity = { source_commit: run(["rev-parse", "HEAD"]), source_tree: run(["rev-parse", "HEAD^{tree}"]), clean: run(["status", "--porcelain"]) === "" };
  if (!COMMIT.test(identity.source_commit) || !COMMIT.test(identity.source_tree)) stop(STOP.git);
  if (!identity.clean) stop(STOP.dirty);
  return identity;
}

export async function verifyReady(root = process.cwd()) {
  const readJson = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
  const decision = validateDecisionControl(await readJson("config/s2-t292-dice-v4-decision-control.json"));
  const decisionSeal = validateDecisionSeal(await readJson("config/s2-t292-dice-v4-decision-package-seal.json"));
  const control = validateT287Control(await readJson("config/s2-t287-dice-v4-deployment-control.json"));
  const seal = validateT287Seal(await readJson("config/s2-t287-dice-v4-deployment-package-seal.json"));
  await verifyPinnedSources(control, root);
  await verifyAuthorizationPackage(seal, root);
  await verifyDecisionSeal(decisionSeal, root);
  if (decision.runtime_package_sha256 !== control.runtime_package_sha256 || decision.authorization_package_sha256 !== seal.authorization_package_sha256) stop(STOP.package);
  return { decision, decisionSeal, control, seal };
}

export async function createReviewPacket({ requestId, issuerPublicKeySpkiSha256, issuerKeyId, root = process.cwd() }) {
  const { decision, decisionSeal, control, seal } = await verifyReady(root);
  const identity = gitIdentity(root);
  const request = createAuthorizationRequest(control, seal, identity, requestId, issuerPublicKeySpkiSha256, issuerKeyId);
  validateAuthorizationRequest(request, control, seal, identity);
  const packet = {
    schema: "s2_t292_dice_v4_microsoft_decision_packet_v1",
    decision_requested: NEXT_DECISION,
    source_commit: identity.source_commit,
    source_tree: identity.source_tree,
    runtime_package_sha256: decision.runtime_package_sha256,
    authorization_package_sha256: decision.authorization_package_sha256,
    decision_packet_sha256: decisionSeal.decision_packet_sha256,
    authorization_request: request,
    configuration_names: decision.configuration_names,
    disabled_probe_expectations: Object.fromEntries(decision.disabled_probes.map((name) => [name, decision.expected_disabled_result])),
    rollback: decision.rollback,
    post_deploy: decision.post_deploy,
    migration_0039_authorized: false,
    normal_chat_authority: decision.normal_chat_authority,
    azure_traffic_authority: decision.azure_traffic_authority,
  };
  return Object.freeze({ ...packet, packet_sha256: sha256(`${JSON.stringify(packet)}\n`) });
}
