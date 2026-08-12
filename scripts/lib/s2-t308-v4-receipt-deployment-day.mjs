import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  claimAuthorization,
  validateAuthorizationReceipt,
  validateAuthorizationRequest,
} from "./s2-t287-dice-v4-deployment-authorization.mjs";
import { verifyPackage as verifyT303Package } from "./s2-t303-dice-default-off-final.mjs";

export const WAITING = "WAITING_FOR_SEPARATE_LUMIS_FOUNDER_V4_DEPLOYMENT_AUTHORIZATION";
export const NEXT_ACTION = "SUPPLY_SIGNED_V4_DEFAULT_OFF_DEPLOYMENT_RECEIPT";
export const STOP = Object.freeze({
  control: "STOP_S2_T308_CONTROL_INVALID",
  seal: "STOP_S2_T308_PACKAGE_DRIFT",
  dirty: "STOP_S2_T308_WORKTREE_NOT_CLEAN",
  receipt: "STOP_S2_T308_RECEIPT_INVALID",
  stale: "STOP_S2_T308_RECEIPT_STALE",
  replay: "STOP_S2_T308_RECEIPT_REPLAYED",
  project: "STOP_S2_T308_WRONG_PROJECT",
  function: "STOP_S2_T308_WRONG_FUNCTION",
  package: "STOP_S2_T308_WRONG_PACKAGE",
  switches: "STOP_S2_T308_SWITCH_AUTHORITY_INVALID",
  rollback: "STOP_S2_T308_ROLLBACK_REVISION_REQUIRED",
  migration: "STOP_S2_T308_MIGRATION_NOT_AUTHORIZED",
  traffic: "STOP_S2_T308_TRAFFIC_NOT_AUTHORIZED",
  signature: "STOP_S2_T308_FOUNDER_ISSUER_SIGNATURE_INVALID",
  claim: "STOP_S2_T308_DURABLE_CLAIM_FAILED",
});

export class T308Stop extends Error {
  constructor(code) { super(code); this.name = "T308Stop"; this.code = code; }
}

const stop = (code) => { throw new T308Stop(code); };
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const REVISION = /^(?:absent|version-[0-9]+)$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameArray = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const probes = ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"];

export function validateControl(control) {
  exact(control, ["schema", "status", "next_action", "authorization_scope", "project_ref", "function_name", "source_authority", "authorization", "required_receipt_values", "disabled_probes", "expected_disabled_result", "automatic_rollback", "pre_receipt_boundary", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t308_v4_receipt_deployment_day_control_v1" || control.status !== WAITING || control.next_action !== NEXT_ACTION) stop(STOP.control);
  if (control.authorization_scope !== "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" || control.project_ref !== "bmqhwofmdgebpcihjlnb" || control.function_name !== "dice-synthetic") stop(STOP.control);
  exact(control.source_authority, ["t303_commit", "t303_package_sha256", "runtime_package_sha256", "authorization_package_sha256"], STOP.control);
  if (control.source_authority.t303_commit !== "85f6e308a752393105eac99216f79df5e18c8a20" || control.source_authority.t303_package_sha256 !== "9458ebb50767d48e6b875e2c41e8027cf711312e64c972b4e6650af10dcfd54b" || control.source_authority.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || control.source_authority.authorization_package_sha256 !== "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2") stop(STOP.control);
  exact(control.authorization, ["schema", "signature_algorithm", "issuer", "trust_anchor_owner", "clock_policy", "window_seconds", "single_use", "durable_claim_before_remote"], STOP.control);
  if (control.authorization.schema !== "lumis_dice_default_off_function_deployment_authorization_v4" || control.authorization.signature_algorithm !== "Ed25519" || control.authorization.issuer !== "Lumis Founder Deployment Approver" || control.authorization.trust_anchor_owner !== "Founder" || control.authorization.clock_policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW" || control.authorization.window_seconds !== 900 || control.authorization.single_use !== true || control.authorization.durable_claim_before_remote !== true) stop(STOP.control);
  exact(control.required_receipt_values, ["kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "migration_application_authorized", "rollback_revision_required"], STOP.control);
  if (control.required_receipt_values.kill_switch_required !== false || control.required_receipt_values.traffic_switch_required !== false || control.required_receipt_values.provider_calls_authorized !== 0 || control.required_receipt_values.model_invocations_authorized !== 0 || control.required_receipt_values.migration_application_authorized !== false || control.required_receipt_values.rollback_revision_required !== true) stop(STOP.control);
  if (!sameArray(control.disabled_probes, probes) || control.expected_disabled_result !== "DICE_AI_DISABLED") stop(STOP.control);
  exact(control.automatic_rollback, ["required", "new_function_action", "existing_function_action", "migration_0039_unchanged"], STOP.control);
  if (control.automatic_rollback.required !== true || control.automatic_rollback.new_function_action !== "DELETE_DICE_SYNTHETIC_ONLY" || control.automatic_rollback.existing_function_action !== "RESTORE_CAPTURED_PRIOR_SOURCE" || control.automatic_rollback.migration_0039_unchanged !== true) stop(STOP.control);
  exact(control.pre_receipt_boundary, ["cli_construction", "client_construction", "credential_reads", "remote_calls", "receipt_writes"], STOP.control);
  if (Object.values(control.pre_receipt_boundary).some((value) => value !== 0)) stop(STOP.control);
  if (control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export function validateSeal(seal) {
  exact(seal, ["schema", "base_commit", "package_sha256", "files"], STOP.seal);
  if (seal.schema !== "s2_t308_v4_receipt_deployment_day_package_seal_v1" || seal.base_commit !== "85f6e308a752393105eac99216f79df5e18c8a20" || !SHA256.test(seal.package_sha256)) stop(STOP.seal);
  if (!isRecord(seal.files) || Object.keys(seal.files).length < 6 || Object.values(seal.files).some((digest) => !SHA256.test(digest))) stop(STOP.seal);
  const canonical = Object.entries(seal.files).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
  if (sha256(`${canonical}\n`) !== seal.package_sha256) stop(STOP.seal);
  return seal;
}

export async function verifyPackage(root = process.cwd(), { requireClean = true } = {}) {
  const json = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
  const control = validateControl(await json("config/s2-t308-v4-receipt-deployment-day-control.json"));
  const seal = validateSeal(await json("config/s2-t308-v4-receipt-deployment-day-package-seal.json"));
  for (const [path, expected] of Object.entries(seal.files)) {
    const bytes = await readFile(`${root}/${path}`).catch(() => stop(STOP.seal));
    if (sha256(bytes) !== expected) stop(STOP.seal);
  }
  const upstream = await verifyT303Package(root, { requireClean: false }).catch(() => stop(STOP.package));
  if (upstream.seal.package_sha256 !== control.source_authority.t303_package_sha256 || upstream.control.runtime_package_sha256 !== control.source_authority.runtime_package_sha256 || upstream.control.authorization_package_sha256 !== control.source_authority.authorization_package_sha256) stop(STOP.package);
  const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const identity = { source_commit: run(["rev-parse", "HEAD"]), source_tree: run(["rev-parse", "HEAD^{tree}"]), clean: run(["status", "--porcelain"]) === "" };
  if (!COMMIT.test(identity.source_commit) || !COMMIT.test(identity.source_tree)) stop(STOP.package);
  if (requireClean && !identity.clean) stop(STOP.dirty);
  return { control, seal, upstream, identity };
}

function classifyReceipt(receipt, request, ready, now) {
  if (!isRecord(receipt) || !isRecord(request)) stop(STOP.receipt);
  if (receipt.project_ref !== ready.control.project_ref) stop(STOP.project);
  if (receipt.function_name !== ready.control.function_name) stop(STOP.function);
  if (receipt.runtime_package_sha256 !== ready.control.source_authority.runtime_package_sha256 || receipt.authorization_package_sha256 !== ready.control.source_authority.authorization_package_sha256 || receipt.source_commit !== ready.identity.source_commit || receipt.source_tree !== ready.identity.source_tree) stop(STOP.package);
  if (receipt.kill_switch_required !== false) stop(STOP.switches);
  if (receipt.traffic_switch_required !== false || receipt.provider_calls_authorized !== 0 || receipt.model_invocations_authorized !== 0) stop(STOP.traffic);
  if (receipt.migration_application_authorized !== false) stop(STOP.migration);
  if (!REVISION.test(receipt.rollback_revision)) stop(STOP.rollback);
  if (receipt.authorization_window_seconds !== 900 || receipt.clock_policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW") stop(STOP.receipt);
  const issued = Date.parse(receipt.issued_at);
  if (!Number.isFinite(issued) || issued > now + 300_000) stop(STOP.receipt);
  if (now - issued >= 900_000) stop(STOP.stale);
  if (request.request_sha256 !== receipt.request_sha256 || request.project_ref !== receipt.project_ref || request.function_name !== receipt.function_name) stop(STOP.receipt);
}

export async function validateAndClaim({ root = process.cwd(), request, receipt, issuerPublicKeyPem, ledgerPath, now = Date.now(), consume = true, requireClean = true }) {
  const ready = await verifyPackage(root, { requireClean });
  classifyReceipt(receipt, request, ready, now);
  const validationIdentity = requireClean ? ready.identity : { ...ready.identity, clean: true };
  let authorization;
  try {
    validateAuthorizationRequest(request, ready.upstream.upstream.t287Control, ready.upstream.upstream.t287Seal, validationIdentity);
    authorization = validateAuthorizationReceipt(receipt, ready.upstream.upstream.t287Control, ready.upstream.upstream.t287Seal, request, validationIdentity, issuerPublicKeyPem, now);
  } catch (error) {
    if (error?.code === "STOP_S2_T287_FOUNDER_ISSUER_SIGNATURE_INVALID") stop(STOP.signature);
    if (error?.code === "STOP_S2_T287_AUTHORIZATION_EXPIRED") stop(STOP.stale);
    if (error?.code === "STOP_S2_T287_WRONG_PROJECT") stop(STOP.project);
    if (error?.code === "STOP_S2_T287_WRONG_FUNCTION") stop(STOP.function);
    if (error?.code === "STOP_S2_T287_WRONG_PACKAGE") stop(STOP.package);
    stop(STOP.receipt);
  }
  if (consume) {
    if (typeof ledgerPath !== "string" || ledgerPath.length === 0) stop(STOP.claim);
    try { await claimAuthorization(authorization, ledgerPath); }
    catch (error) {
      if (error?.code === "STOP_S2_T287_DEPLOYMENT_CLAIM_REPLAYED") stop(STOP.replay);
      stop(STOP.claim);
    }
  }
  return { ready, authorization };
}

export function validateDisabledProbeResults(results) {
  exact(results, probes, STOP.receipt);
  if (probes.some((name) => results[name] !== "DICE_AI_DISABLED")) stop(STOP.receipt);
  return results;
}
