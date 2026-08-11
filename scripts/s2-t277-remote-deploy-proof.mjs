#!/usr/bin/env node
import { chmod, readFile, writeFile } from "node:fs/promises";
import { sha256, validateControl } from "./lib/s2-t277-dice-deployment-authorization.mjs";

const args = Object.fromEntries(process.argv.slice(3).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));
const command = process.argv[2];
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const stop = (code) => { process.stderr.write(`${code}\n`); process.exit(1); };

if (command === "configuration") {
  const control = validateControl(await readJson(args.control));
  const payload = await readJson(args.input).catch(() => stop("STOP_S2_T277_CONFIGURATION_RESPONSE_UNSAFE"));
  if (!Array.isArray(payload)) stop("STOP_S2_T277_CONFIGURATION_RESPONSE_UNSAFE");
  const names = payload.map((item) => item?.name).filter((name) => typeof name === "string");
  if (names.length !== payload.length || control.configuration_names.some((name) => !names.includes(name))) stop("STOP_S2_T277_CONFIGURATION_NAMES_MISSING");
  process.stdout.write("S2_T277_CONFIGURATION_NAMES_OK\n");
} else if (command === "revision") {
  const payload = await readJson(args.input).catch(() => stop("STOP_S2_T277_FUNCTION_LIST_UNSAFE"));
  if (!Array.isArray(payload)) stop("STOP_S2_T277_FUNCTION_LIST_UNSAFE");
  const matching = payload.filter((item) => item?.name === "dice-synthetic");
  if (matching.length > 1) stop("STOP_S2_T277_FUNCTION_LIST_UNSAFE");
  if (matching.length === 0) process.stdout.write("absent\n");
  else {
    const version = matching[0]?.version;
    if (!(typeof version === "number" || typeof version === "string") || !/^[0-9]+$/u.test(String(version))) stop("STOP_S2_T277_FUNCTION_LIST_UNSAFE");
    process.stdout.write(`version-${version}\n`);
  }
} else if (command === "probe") {
  const status = Number(args.status);
  const payload = await readJson(args.input).catch(() => stop("STOP_S2_T277_DISABLED_PROBE_UNSAFE"));
  if (status !== 503 || JSON.stringify(payload) !== JSON.stringify({ error: { code: "DICE_AI_DISABLED" } })) stop("STOP_S2_T277_DISABLED_PROBE_FAILED");
  process.stdout.write("DICE_AI_DISABLED\n");
} else if (command === "receipt") {
  const control = validateControl(await readJson(args.control));
  const authorization = await readJson(args.authorization).catch(() => stop("STOP_S2_T277_AUTHORIZATION_INVALID"));
  if (!/^dice-deploy-[a-z0-9]{16,40}$/u.test(authorization.single_use_deployment_id)) stop("STOP_S2_T277_AUTHORIZATION_INVALID");
  if (!/^(?:absent|version-[0-9]+)$/u.test(args.rollback) || !/^version-[0-9]+$/u.test(args.deployed)) stop("STOP_S2_T277_FUNCTION_LIST_UNSAFE");
  const probes = Object.fromEntries(control.disabled_probes.map((name) => [name, "DICE_AI_DISABLED"]));
  const receipt = {
    schema: "s2_t277_dice_default_off_deployment_receipt_v1",
    project_ref: control.project_ref,
    function_name: control.function_name,
    deployment_id: authorization.single_use_deployment_id,
    authorization_sha256: sha256(`${JSON.stringify(authorization)}\n`),
    source_commit: control.source_commit,
    runtime_package_sha256: control.runtime_package_sha256,
    configuration_names_verified: true,
    kill_switch_disabled: true,
    traffic_switch_disabled: true,
    function_version: Number(args.deployed.slice("version-".length)),
    rollback_revision: args.rollback,
    disabled_probes: probes,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    migration_applied: false,
    rollback_target: control.rollback.target,
    deployed_at: new Date().toISOString(),
    credentials_unset: true
  };
  await writeFile(args.output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" }).catch(() => stop("STOP_S2_T277_RECEIPT_WRITE_FAILED"));
  await chmod(args.output, 0o600);
  process.stdout.write("S2_T277_POST_DEPLOY_RECEIPT_WRITTEN\n");
} else stop("STOP_S2_T277_REMOTE_HELPER_ARGUMENTS_INVALID");
