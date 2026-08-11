#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
  validatePackageSeal,
  verifyAuthorizationPackage,
  verifyPinnedSources,
} from "./lib/s2-t287-dice-v4-deployment-authorization.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...parts] = arg.replace(/^--/u, "").split("=");
  return [key, parts.join("=") || true];
}));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const gitIdentity = () => ({
  source_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  source_tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
  clean: execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() === "",
});

try {
  const control = validateControl(await readJson("config/s2-t287-dice-v4-deployment-control.json"));
  const seal = validatePackageSeal(await readJson("config/s2-t287-dice-v4-deployment-package-seal.json"));
  await verifyPinnedSources(control);
  await verifyAuthorizationPackage(seal);
  const identity = gitIdentity();
  if (typeof args["request-id"] === "string") {
    const request = createAuthorizationRequest(control, seal, identity, args["request-id"], args["signing-key-sha256"]);
    process.stdout.write(`${JSON.stringify(request, null, 2)}\n`);
    process.exit(0);
  }

  const state = {};
  let authorization;
  if (typeof args.authorization === "string" || typeof args.request === "string") {
    if (typeof args.authorization !== "string" || typeof args.request !== "string") throw new DeploymentStop("STOP_S2_T287_AUTHORIZATION_REQUIRED");
    const request = validateAuthorizationRequest(await readJson(args.request), control, seal, identity);
    if (typeof args["microsoft-public-key"] !== "string") throw new DeploymentStop("STOP_S2_T287_AUTHORIZATION_REQUIRED");
    authorization = validateAuthorizationReceipt(await readJson(args.authorization), control, seal, request, identity, await readFile(args["microsoft-public-key"], "utf8"));
    state.authorization = true;
  }
  if (args["consume-claim"] === true) {
    if (!authorization || typeof args.ledger !== "string") throw new DeploymentStop("STOP_S2_T287_DEPLOYMENT_CLAIM_FAILED");
    await claimAuthorization(authorization, args.ledger);
    state.claim = true;
  }
  if (typeof args.deployed === "string") {
    validatePostDeployReceipt(await readJson(args.deployed), authorization, control, seal);
    state.deployed = true;
  }
  if (typeof args.rollback === "string") {
    validateRollbackReceipt(await readJson(args.rollback), authorization, control);
    state.rollback = true;
  }
  process.stdout.write(`${JSON.stringify({ status: control.status, authorization_scope: control.authorization_scope, next_action: nextGate(state), project: "exact_staging", function_name: control.function_name, migration_authorized: false, remote_calls: 0, provider_calls: 0, model_invocations: 0, deployment_calls: 0 })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof DeploymentStop ? error.code : "STOP_S2_T287_INPUT_UNSAFE"}\n`);
  process.exitCode = 1;
}
