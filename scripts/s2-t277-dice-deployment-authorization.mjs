#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  DeploymentStop,
  claimAuthorization,
  createAuthorizationRequest,
  nextGate,
  validateAuthorizationReceipt,
  validateAuthorizationRequest,
  validateControl,
  validatePostDeployReceipt,
  validateRollbackReceipt,
  verifyPinnedSources,
} from "./lib/s2-t277-dice-deployment-authorization.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...parts] = arg.replace(/^--/u, "").split("=");
  return [key, parts.join("=") || true];
}));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

try {
  const control = validateControl(await readJson("config/s2-t277-dice-deployment-authorization.json"));
  await verifyPinnedSources(control);
  if (typeof args["request-id"] === "string") {
    const request = createAuthorizationRequest(control, args["request-id"], args["issued-at"], args["valid-until"], args["signing-key-sha256"]);
    process.stdout.write(`${JSON.stringify(request, null, 2)}\n`);
    process.exit(0);
  }

  const state = {};
  let authorization;
  if (typeof args.authorization === "string" || typeof args.request === "string") {
    if (typeof args.authorization !== "string" || typeof args.request !== "string") throw new DeploymentStop("STOP_S2_T277_AUTHORIZATION_REQUIRED");
    const request = validateAuthorizationRequest(await readJson(args.request), control);
    if (typeof args["microsoft-public-key"] !== "string") throw new DeploymentStop("STOP_S2_T277_AUTHORIZATION_REQUIRED");
    authorization = validateAuthorizationReceipt(await readJson(args.authorization), control, request, await readFile(args["microsoft-public-key"], "utf8"));
    state.authorization = true;
  }
  if (args["consume-claim"] === true) {
    if (!authorization || typeof args.ledger !== "string") throw new DeploymentStop("STOP_S2_T277_DEPLOYMENT_CLAIM_FAILED");
    await claimAuthorization(authorization, args.ledger);
    state.claim = true;
  }
  if (typeof args.deployed === "string") {
    validatePostDeployReceipt(await readJson(args.deployed), authorization, control);
    state.deployed = true;
  }
  if (typeof args.rollback === "string") {
    validateRollbackReceipt(await readJson(args.rollback), authorization, control);
    state.rollback = true;
  }
  process.stdout.write(`${JSON.stringify({ status: control.status, authorization_scope: control.authorization_scope, next_action: nextGate(state), project: "exact_staging", function_name: control.function_name, migration_authorized: false, remote_calls: 0, provider_calls: 0, model_invocations: 0, deployment_calls: 0 })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof DeploymentStop ? error.code : "STOP_S2_T277_INPUT_UNSAFE"}\n`);
  process.exitCode = 1;
}
