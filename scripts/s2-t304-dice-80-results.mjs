#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

import { STOP, loadControl } from "./lib/s2-t304-dice-80-results.mjs";
import { validateReceipts } from "./lib/s2-t294-dice-control-room.mjs";

const args = process.argv.slice(2);
const command = args[0] ?? "status";
const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const readJson = (path, code) => {
  if (!path || !existsSync(path)) { console.log(JSON.stringify({ status: code, remote_calls: 0 })); process.exit(2); }
  return JSON.parse(readFileSync(path, "utf8"));
};

loadControl();
if (command === "status") {
  console.log(JSON.stringify({ status: STOP.deployment, next_action: "Obtain the separately accepted v4 post-deploy disabled receipt.", remote_calls: 0, authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"] }));
  process.exit(2);
}
if (command === "preflight") {
  const receipts = {
    deployment: readJson(value("--deployment-receipt"), STOP.deployment),
    migration: readJson(value("--migration-receipt"), STOP.migration),
    traffic: readJson(value("--traffic-authorization"), STOP.traffic)
  };
  validateReceipts(receipts);
  console.log(JSON.stringify({ status: "READY_FOR_SEPARATELY_REVIEWED_GATEWAY_ADAPTER", next_action: "Run only through the separately reviewed credential-bearing adapter; this command constructs no client.", remote_calls: 0 }));
  process.exit(0);
}
console.log(JSON.stringify({ status: "STOP_S2_T304_UNKNOWN_COMMAND", remote_calls: 0 }));
process.exit(2);
