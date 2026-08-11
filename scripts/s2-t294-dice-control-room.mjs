#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { STOP, createRedactedExport, exportSha, loadControl, readJournal, requestKill, summarize, validateReceipts } from "./lib/s2-t294-dice-control-room.mjs";

const args = process.argv.slice(2);
const command = args[0] ?? "status";
const value = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const readJson = (path, stop) => { if (!path || !existsSync(path)) { console.log(JSON.stringify({ status: stop, remote_calls: 0 })); process.exit(2); } return JSON.parse(readFileSync(path, "utf8")); };
const { control, registry } = loadControl();
const journalPath = resolve(value("--journal") ?? ".lumis-local/s2-t294/run-journal.json");

if (command === "status") {
  if (!existsSync(journalPath)) { console.log(JSON.stringify({ status: STOP.deployment, next_action: "Obtain the accepted v4 post-deploy disabled receipt.", remote_calls: 0 })); process.exit(2); }
  console.log(JSON.stringify({ status: "LOCAL_JOURNAL_STATUS", ...summarize(readJournal(journalPath, registry), control), remote_calls: 0 }));
} else if (command === "kill") {
  console.log(JSON.stringify({ ...requestKill(journalPath, registry), remote_calls: 0 }));
} else if (command === "export") {
  const review = createRedactedExport(readJournal(journalPath, registry), control);
  const output = resolve(value("--output") ?? ".lumis-local/s2-t294/redacted-review.json");
  writeFileSync(output, `${JSON.stringify(review, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: "REDACTED_REVIEW_WRITTEN", sha256: exportSha(review), rows: 80, live_azure_proof: false, remote_calls: 0 }));
} else if (command === "preflight") {
  const receipts = { deployment: readJson(value("--deployment-receipt"), STOP.deployment), migration: readJson(value("--migration-receipt"), STOP.migration), traffic: readJson(value("--traffic-authorization"), STOP.traffic) };
  validateReceipts(receipts);
  console.log(JSON.stringify({ status: "READY_FOR_SEPARATELY_REVIEWED_REMOTE_GATEWAY_ADAPTER", journal: journalPath, remote_calls: 0, next_action: "Use the separately reviewed credential-bearing adapter. This command never constructs a client." }));
} else {
  console.log(JSON.stringify({ status: "STOP_S2_T294_UNKNOWN_COMMAND", remote_calls: 0 })); process.exit(2);
}
