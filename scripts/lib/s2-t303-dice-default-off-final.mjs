import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  T298Stop,
  validateExecutionAuthorization as validateT298ExecutionAuthorization,
  verifyOfflinePreflight as verifyT298OfflinePreflight,
} from "./s2-t298-dice-v4-zero-call.mjs";

export const NEXT_ACTION = "AUTHORIZE_DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY";
export const WAITING = "WAITING_FOR_SEPARATE_LUMIS_FOUNDER_V4_DEPLOYMENT_AUTHORIZATION";
export const STOP = Object.freeze({
  control: "STOP_S2_T303_CONTROL_INVALID",
  seal: "STOP_S2_T303_PACKAGE_DRIFT",
  authorization: "STOP_S2_T303_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED",
  unsafe: "STOP_S2_T303_PREFLIGHT_UNSAFE",
});

export class T303Stop extends Error {
  constructor(code) { super(code); this.name = "T303Stop"; this.code = code; }
}

const stop = (code) => { throw new T303Stop(code); };
const SHA256 = /^[a-f0-9]{64}$/u;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys, code) => {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) stop(code);
};
const sameArray = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const probes = ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"];

export function validateControl(control) {
  exact(control, ["schema", "status", "next_action", "authorization_scope", "project_ref", "function_name", "source_authorities", "runtime_package_sha256", "authorization_package_sha256", "authorization_schema", "request_schema", "clock", "single_use", "configuration_names_count", "disabled_probes", "expected_disabled_result", "kill_switch_required", "traffic_switch_required", "provider_calls_authorized", "model_invocations_authorized", "migration_0039_authorized", "rollback_revision_required", "normal_chat_unchanged_required", "pre_authorization", "normal_chat_authority", "azure_traffic_authority"], STOP.control);
  if (control.schema !== "s2_t303_dice_default_off_final_control_v1" || control.status !== WAITING || control.next_action !== NEXT_ACTION) stop(STOP.control);
  if (control.authorization_scope !== "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" || control.project_ref !== "bmqhwofmdgebpcihjlnb" || control.function_name !== "dice-synthetic") stop(STOP.control);
  exact(control.source_authorities, ["t287_commit", "t292_commit", "t298_commit"], STOP.control);
  if (control.source_authorities.t287_commit !== "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432" || control.source_authorities.t292_commit !== "f1288d6159d23317f6f4db05bcf194bc93af65d6" || control.source_authorities.t298_commit !== "69c3de399acf3fa9ec746deaeb7a1880128955ca") stop(STOP.control);
  if (control.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || control.authorization_package_sha256 !== "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2") stop(STOP.control);
  if (control.authorization_schema !== "lumis_dice_default_off_function_deployment_authorization_v4" || control.request_schema !== "lumis_dice_default_off_function_deployment_authorization_request_v4") stop(STOP.control);
  exact(control.clock, ["policy", "window_seconds", "absolute_expiry_embedded"], STOP.control);
  if (control.clock.policy !== "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW" || control.clock.window_seconds !== 900 || control.clock.absolute_expiry_embedded !== false) stop(STOP.control);
  exact(control.single_use, ["required", "durable_claim_before_remote", "replay_rejected"], STOP.control);
  if (Object.values(control.single_use).some((value) => value !== true)) stop(STOP.control);
  if (control.configuration_names_count !== 15 || !sameArray(control.disabled_probes, probes) || control.expected_disabled_result !== "DICE_AI_DISABLED") stop(STOP.control);
  if (control.kill_switch_required !== false || control.traffic_switch_required !== false || control.provider_calls_authorized !== 0 || control.model_invocations_authorized !== 0 || control.migration_0039_authorized !== false || control.rollback_revision_required !== true || control.normal_chat_unchanged_required !== true) stop(STOP.control);
  exact(control.pre_authorization, ["remote_commands", "client_construction", "credential_reads", "receipt_mutations"], STOP.control);
  if (Object.values(control.pre_authorization).some((value) => value !== 0)) stop(STOP.control);
  if (control.normal_chat_authority !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || control.azure_traffic_authority !== "NO_AZURE_TRAFFIC_AUTHORITY") stop(STOP.control);
  return control;
}

export function validateSeal(seal) {
  exact(seal, ["schema", "base_commit", "runtime_package_sha256", "authorization_package_sha256", "package_sha256", "files"], STOP.seal);
  if (seal.schema !== "s2_t303_dice_default_off_final_package_seal_v1" || seal.base_commit !== "69c3de399acf3fa9ec746deaeb7a1880128955ca" || seal.runtime_package_sha256 !== "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457" || seal.authorization_package_sha256 !== "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2" || !SHA256.test(seal.package_sha256)) stop(STOP.seal);
  if (!isRecord(seal.files) || Object.keys(seal.files).length < 6 || Object.values(seal.files).some((digest) => !SHA256.test(digest))) stop(STOP.seal);
  const canonical = Object.entries(seal.files).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
  if (sha256(`${canonical}\n`) !== seal.package_sha256) stop(STOP.seal);
  return seal;
}

export async function verifyPackage(root = process.cwd(), { requireClean = true } = {}) {
  const readJson = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
  const control = validateControl(await readJson("config/s2-t303-dice-default-off-final-control.json"));
  const seal = validateSeal(await readJson("config/s2-t303-dice-default-off-final-package-seal.json"));
  for (const [path, expected] of Object.entries(seal.files)) {
    const bytes = await readFile(`${root}/${path}`).catch(() => stop(STOP.seal));
    if (sha256(bytes) !== expected) stop(STOP.seal);
  }
  let upstream;
  try { upstream = await verifyT298OfflinePreflight(root, { allowUntracked: !requireClean }); }
  catch (error) { if (error instanceof T298Stop) throw error; stop(STOP.unsafe); }
  if (upstream.control.runtime_package_sha256 !== control.runtime_package_sha256 || upstream.control.authorization_package_sha256 !== control.authorization_package_sha256) stop(STOP.seal);
  return { control, seal, upstream };
}

export async function validateOperationalAuthorization(input) {
  await verifyPackage(input.root ?? process.cwd());
  try { return await validateT298ExecutionAuthorization(input); }
  catch (error) { if (error instanceof T298Stop || typeof error?.code === "string") throw error; stop(STOP.authorization); }
}
