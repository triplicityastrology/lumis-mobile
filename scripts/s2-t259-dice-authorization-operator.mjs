#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  OperatorStop, runTechnical80, STOP, verifySourceSeal,
  validateControl, validateMicrosoftAuthorization, validatePostDeployReceipt,
  validateTechnicalRegistry, WAITING,
} from "./lib/s2-t259-dice-authorization-operator.mjs";
import { createFileDeploymentClaimAuthority } from "./lib/s2-t259-durable-deployment-claim.mjs";

const args = process.argv.slice(2);
const get = (flag) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const required = ["--control", "--microsoft-manifest", "--post-deploy-receipt", "--registry", "--gateway-module", "--replay-ledger"];

if (args.includes("--help")) {
  console.log("pnpm dice:authorization-operator -- --execute-technical --control FILE --microsoft-manifest FILE --post-deploy-receipt FILE --registry FILE --gateway-module FILE --replay-ledger FILE");
  process.exit(0);
}

if (!args.includes("--execute-technical")) {
  console.log(JSON.stringify({ status: WAITING, project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic", provider_calls: 0, network_calls: 0, deployment_calls: 0, founder_cases_run: 0, next_action: "Await explicit deployment and Azure traffic authority; candidate remains default-off before provider/client construction." }));
  process.exit(0);
}

if (required.some((flag) => !get(flag))) {
  console.error(WAITING);
  process.exit(2);
}

async function readJson(flag) {
  const text = await readFile(resolve(get(flag)), "utf8");
  return { text, value: JSON.parse(text) };
}

try {
  const [controlFile, authorizationFile, postDeployFile, registryFile] = await Promise.all(required.slice(0, 4).map(readJson));
  const control = validateControl(controlFile.value);
  await verifySourceSeal(control, (path) => readFile(resolve(path)));
  const authorization = validateMicrosoftAuthorization(authorizationFile.value, authorizationFile.text, control);
  validatePostDeployReceipt(postDeployFile.value, authorization, control);
  validateTechnicalRegistry(registryFile.value, control);
  const result = await runTechnical80({
    control,
    authorization,
    postDeployReceipt: postDeployFile.value,
    registry: registryFile.value,
    claimDeployment: createFileDeploymentClaimAuthority({ ledgerPath: resolve(get("--replay-ledger")) }),
    createGatewayExecution: async () => {
      const module = await import(pathToFileURL(resolve(get("--gateway-module"))).href);
      if (typeof module.createDiceSyntheticGatewayExecutionV1 !== "function") throw new OperatorStop(STOP.gateway);
      return module.createDiceSyntheticGatewayExecutionV1({
        deployment_id: authorization.value.single_use_deployment_id,
        source_seal_sha256: control.source_seal.package_sha256,
        fixture_registry_sha256: control.canonical_sha256.registry,
      });
    },
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof OperatorStop ? error.code : "STOP_S2_T259_OPERATOR_FAILED");
  process.exit(2);
}
