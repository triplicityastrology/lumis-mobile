#!/usr/bin/env node
import { chmod, readFile, writeFile } from "node:fs/promises";
import {
  NEXT_ACTION,
  T314Stop,
  claimReceipt,
  createRequest,
  validatePostReceipt,
  validateReceipt,
  verifyPackage,
} from "./lib/s2-t314-final-disabled-deploy.mjs";

const [command = "readiness", ...rawArgs] = process.argv.slice(2);
const args = Object.fromEntries(rawArgs.map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, "").split("=");
  return [key, value.join("=")];
}));
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const required = (names) => {
  for (const name of names) if (!args[name]) throw new T314Stop("STOP_S2_T314_ARGUMENTS_INVALID");
};

try {
  if (command === "readiness") {
    const ready = await verifyPackage();
    process.stdout.write(`${JSON.stringify({
      status: ready.control.status,
      next_action: NEXT_ACTION,
      required_operational_inputs: [
        "secure-custody public key matching founder-ed25519-deployment-approver-v1 / ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478",
        "matching Lumis Founder Deployment Approver signed 900-second single-use receipt",
        "rollback revision",
        "transient deployment credentials after receipt claim",
      ],
      source_commit: ready.identity.source_commit,
      package_sha256: ready.seal.package_sha256,
      founder_registry_sha256: ready.registry.registry_payload_sha256,
      provider_calls: 0,
      remote_calls: 0,
      migration_0039_authorized: false,
      authority_status: [ready.control.normal_chat_authority, ready.control.azure_traffic_authority],
    })}\n`);
    process.exitCode = 2;
  } else if (command === "request") {
    required(["request-id", "issuer-key-id", "issuer-public-key", "output"]);
    const ready = await verifyPackage();
    const request = createRequest(ready, { requestId: args["request-id"], issuerKeyId: args["issuer-key-id"], publicKeyPem: await readFile(args["issuer-public-key"], "utf8") });
    await writeFile(args.output, `${JSON.stringify(request, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await chmod(args.output, 0o600);
    process.stdout.write("S2_T314_FOUNDER_DEPLOYMENT_REQUEST_WRITTEN\n");
  } else if (command === "intake") {
    required(["request", "authorization", "issuer-public-key", "claim-ledger"]);
    const ready = await verifyPackage();
    const request = await json(args.request);
    const authorization = validateReceipt(await json(args.authorization), request, ready, await readFile(args["issuer-public-key"], "utf8"));
    await claimReceipt(authorization, args["claim-ledger"]);
    process.stdout.write(`S2_T314_FOUNDER_RECEIPT_CLAIMED deployment_id=${authorization.deploymentId}\n`);
  } else if (command === "post-receipt") {
    required(["request", "authorization", "issuer-public-key", "legacy-receipt", "output"]);
    const ready = await verifyPackage();
    const request = await json(args.request);
    const authorization = validateReceipt(await json(args.authorization), request, ready, await readFile(args["issuer-public-key"], "utf8"));
    const legacy = await json(args["legacy-receipt"]);
    const output = {
      schema: "s2_t314_zero_call_post_deploy_receipt_v1",
      project_ref: ready.control.project_ref,
      function_name: ready.control.function_name,
      deployment_id: authorization.deploymentId,
      authorization_sha256: authorization.authorizationSha256,
      request_sha256: authorization.requestSha256,
      issuer_key_id: authorization.issuerKeyId,
      issuer_public_key_spki_sha256: authorization.issuerPublicKeySpkiSha256,
      source_commit: ready.identity.source_commit,
      source_tree: ready.identity.source_tree,
      package_sha256: ready.seal.package_sha256,
      runtime_package_sha256: ready.control.source_authority.runtime_package_sha256,
      founder_registry_sha256: ready.registry.registry_payload_sha256,
      kill_switch_disabled: true,
      traffic_switch_disabled: true,
      function_version: legacy.function_version,
      rollback_revision: authorization.rollbackRevision,
      disabled_probes: legacy.disabled_probes,
      provider_calls: 0,
      model_invocations: 0,
      normal_chat_unchanged: true,
      migration_0039_applied: false,
      rollback_target: ready.control.rollback.target,
      deployed_at: legacy.deployed_at,
      credentials_unset: true,
    };
    validatePostReceipt(output, authorization, ready);
    await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await chmod(args.output, 0o600);
    process.stdout.write("S2_T314_ZERO_CALL_POST_DEPLOY_RECEIPT_WRITTEN\n");
  } else if (command === "observation") {
    required(["rollback-revision", "deployed-revision", "output"]);
    if (!/^(absent|version-[0-9]+)$/u.test(args["rollback-revision"]) || !/^version-[0-9]+$/u.test(args["deployed-revision"])) {
      throw new T314Stop("STOP_S2_T314_POST_DEPLOY_RECEIPT_INVALID");
    }
    const observation = {
      schema: "s2_t314_closed_deployment_observation_v1",
      function_version: Number(args["deployed-revision"].slice("version-".length)),
      rollback_revision: args["rollback-revision"],
      disabled_probes: {
        unknown_fixture: "DICE_AI_DISABLED",
        free_form_body: "DICE_AI_DISABLED",
        normal_mobile_body: "DICE_AI_DISABLED",
        allow_listed_fixture: "DICE_AI_DISABLED",
      },
      provider_calls: 0,
      model_invocations: 0,
      deployed_at: new Date().toISOString(),
    };
    await writeFile(args.output, `${JSON.stringify(observation, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await chmod(args.output, 0o600);
    process.stdout.write("S2_T314_DEPLOYMENT_OBSERVATION_WRITTEN\n");
  } else {
    throw new T314Stop("STOP_S2_T314_ARGUMENTS_INVALID");
  }
} catch (error) {
  process.stderr.write(`${error instanceof T314Stop ? error.code : "STOP_S2_T314_UNSAFE"}\n`);
  process.exitCode = 1;
}
