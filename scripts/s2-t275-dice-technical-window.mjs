#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { loadAndValidateControl, STOP, validateDeploymentReceipt, validateTrafficAuthority } from "./lib/s2-t275-dice-technical-window.mjs";

const args = new Map(process.argv.slice(2).map((item, index, all) => item.startsWith("--") ? [item, all[index + 1]] : [item, undefined]));
const { control } = loadAndValidateControl();
const deploymentPath = args.get("--deployment-receipt");
const trafficPath = args.get("--traffic-authorization");
if (!deploymentPath || !existsSync(deploymentPath)) {
  console.log(JSON.stringify({ status: STOP.deployment, provider_calls: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0, next_action: "Import the accepted default-off deployment receipt bound to T267." }));
  process.exit(2);
}
if (!trafficPath || !existsSync(trafficPath)) {
  console.log(JSON.stringify({ status: STOP.traffic, provider_calls: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0, next_action: "Obtain Microsoft Dice Technical traffic authority bound to the accepted deployment and T267 package." }));
  process.exit(2);
}
const deployment = validateDeploymentReceipt(JSON.parse(readFileSync(deploymentPath, "utf8")), control);
validateTrafficAuthority(JSON.parse(readFileSync(trafficPath, "utf8")), control, deployment);
console.log(JSON.stringify({ status: "READY_FOR_GUARDED_REMOTE_RUNNER_INTEGRATION", provider_calls: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0, next_action: "Use a separately reviewed credential-bearing execution wrapper; this source command remains inert." }));
