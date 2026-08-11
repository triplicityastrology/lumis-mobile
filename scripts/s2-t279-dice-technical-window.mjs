#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { loadAndValidateControl, STOP, validateDeploymentReceipt, validateMigrationReceipt, validateTrafficAuthority } from "./lib/s2-t279-dice-technical-window.mjs";

const values = process.argv.slice(2);
const get = (name) => {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
};
const readClosed = (path, stop) => {
  if (!path || !existsSync(path)) {
    console.log(JSON.stringify({ status: stop, provider_calls: 0, model_invocations: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0 }));
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, "utf8"));
};

const { control } = loadAndValidateControl();
const deployment = validateDeploymentReceipt(readClosed(get("--deployment-receipt"), STOP.deployment), control);
const migration = validateMigrationReceipt(readClosed(get("--migration-receipt"), STOP.migration), control);
validateTrafficAuthority(readClosed(get("--traffic-authorization"), STOP.traffic), control, deployment, migration);
console.log(JSON.stringify({
  status: "READY_FOR_SEPARATELY_REVIEWED_CREDENTIAL_BEARING_EXECUTION_WRAPPER",
  authorization_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  provider_calls: 0,
  model_invocations: 0,
  technical_cases_run: 0,
  founder_cases_run: 0,
  network_calls: 0,
  next_action: "Run the separately reviewed remote wrapper with the three accepted single-use receipts; this command remains zero-network."
}));
