#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { loadAndValidateControl, STOP, validateDeploymentReceipt, validateMigrationReceipt, validateTrafficAuthority } from "./lib/s2-t289-dice-technical-window.mjs";

const args = process.argv.slice(2);
const get = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const stop = (status) => { console.log(JSON.stringify({ status, provider_calls: 0, model_invocations: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0 })); process.exit(2); };
const read = (path, status) => { if (!path || !existsSync(path)) stop(status); return JSON.parse(readFileSync(path, "utf8")); };
const { control } = loadAndValidateControl();
const deployment = validateDeploymentReceipt(read(get("--deployment-receipt"), STOP.deployment), control);
const migration = validateMigrationReceipt(read(get("--migration-receipt"), STOP.migration), control);
validateTrafficAuthority(read(get("--traffic-authorization"), STOP.traffic), control, deployment, migration);
console.log(JSON.stringify({ status: "READY_FOR_SEPARATELY_REVIEWED_CREDENTIAL_BEARING_EXECUTION_WRAPPER", authorization_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY", provider_calls: 0, model_invocations: 0, technical_cases_run: 0, founder_cases_run: 0, network_calls: 0, next_action: "Use the separately reviewed remote runner. This readiness command remains zero-network." }));
