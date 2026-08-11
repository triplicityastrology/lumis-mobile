#!/usr/bin/env node
import { chmod, readFile, writeFile } from "node:fs/promises";
import { validateExecutionAuthorization, validatePostDeployReceipt, sha256, T298Stop } from "./lib/s2-t298-dice-v4-zero-call.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

try {
  for (const name of ["request", "authorization", "microsoft-public-key", "legacy-receipt", "output"]) if (!args[name]) throw new T298Stop("STOP_S2_T298_POST_DEPLOY_RECEIPT_INVALID");
  const request = await readJson(args.request);
  const receipt = await readJson(args.authorization);
  const legacy = await readJson(args["legacy-receipt"]);
  const ready = await validateExecutionAuthorization({ request, receipt, publicKeyPem: await readFile(args["microsoft-public-key"], "utf8") });
  const output = {
    schema: ready.control.post_deploy.schema,
    project_ref: ready.control.project_ref,
    function_name: ready.control.function_name,
    deployment_id: ready.authorization.deploymentId,
    authorization_sha256: ready.authorization.authorizationSha256,
    request_sha256: ready.authorization.requestSha256,
    signing_key_sha256: ready.authorization.signingKeySha256,
    source_commit: ready.authorization.sourceCommit,
    source_tree: ready.authorization.sourceTree,
    runtime_package_sha256: ready.control.runtime_package_sha256,
    authorization_package_sha256: ready.control.authorization_package_sha256,
    configuration_names: ready.control.configuration_names,
    kill_switch_value: false,
    traffic_switch_value: false,
    function_version: legacy.function_version,
    rollback_revision: legacy.rollback_revision,
    disabled_probes: legacy.disabled_probes,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    migration_0039_applied: false,
    rollback_target: ready.control.rollback_target,
    deployed_at: legacy.deployed_at,
    credentials_unset: true,
    legacy_receipt_sha256: sha256(`${JSON.stringify(legacy)}\n`),
  };
  validatePostDeployReceipt(output, legacy, ready.authorization, ready.control, ready.t287Control, ready.t287Seal);
  await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await chmod(args.output, 0o600);
  process.stdout.write("S2_T298_ZERO_CALL_POST_DEPLOY_RECEIPT_WRITTEN\n");
} catch (error) {
  process.stderr.write(`${error instanceof T298Stop ? error.code : error?.code?.startsWith?.("STOP_") ? error.code : "STOP_S2_T298_POST_DEPLOY_RECEIPT_INVALID"}\n`);
  process.exitCode = 1;
}
