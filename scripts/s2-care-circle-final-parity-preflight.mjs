import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  finalParityConstants,
  validateFinalParity
} from "./lib/care-circle-final-parity.mjs";

const args = process.argv.slice(2);
const refIndex = args.indexOf("--project-ref");
const projectRef = refIndex >= 0 ? args[refIndex + 1] : "";

try {
  const deployment = readJson("supabase/tests/s2-t09-care-circle-deployment-control.json");
  const dashboard = readJson("supabase/tests/s2-t40-care-circle-dashboard-packet-control.json");
  const pat = readJson("supabase/tests/s2-t43-care-circle-function-pat-control.json");
  const config = readJson("supabase/tests/s2-t48-care-circle-function-config-control.json");
  const packetCheck = spawnSync(
    process.execPath,
    ["scripts/s2-care-circle-dashboard-packets.mjs", "--check"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  const migrationEntries = deployment.deployment_order.slice(0, 3);
  const packetFiles = readdirSync("supabase/dashboard-packets/s2-t40")
    .filter((name) => name.endsWith(".dashboard.sql"))
    .sort();
  const linkedPath = "supabase/.temp/project-ref";
  const dirtyPaths = git("status", "--porcelain=v1")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3));
  const ancestorPresent = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", finalParityConstants.requiredAncestor, "HEAD"],
    { stdio: "ignore" }
  ).status === 0;

  const edgeFiles = finalParityConstants.requiredEdgeFiles.map(([file]) => [file, sha256(file)]);
  if (deployment.deployment_order[3]?.sha256 !== edgeFiles[0][1]) {
    throw new Error("STOP_S2_T74_EDGE_CONTROL_STALE");
  }
  if (pat.function_sha256 !== edgeFiles[0][1] || config.function_sha256 !== edgeFiles[0][1]) {
    throw new Error("STOP_S2_T74_EDGE_CONTROL_STALE");
  }
  if (deployment.deployment_order[3]?.supporting_files?.[0]?.sha256 !== edgeFiles[1][1]) {
    throw new Error("STOP_S2_T74_EDGE_SUPPORT_CONTROL_STALE");
  }

  const snapshot = {
    projectRef,
    cliVersion: pat.supabase_cli_version,
    ancestorPresent,
    dirtyPaths,
    linkedRef: existsSync(linkedPath) ? readFileSync(linkedPath, "utf8").trim() : null,
    migrations: migrationEntries.map((entry) => [entry.name, sha256(path.join("supabase/migrations", entry.name))]),
    dashboardSources: dashboard.packets.map((entry) => [path.basename(entry.migration_path), entry.source_sha256]),
    edgeFiles,
    dashboardPacketVersions: dashboard.packets.map((entry) => entry.version),
    dashboardPacketParity: packetCheck.status === 0 && packetFiles.length === 3,
    historyColumns: dashboard.history_columns.map((column) => [
      column.name,
      column.data_type,
      column.udt_name,
      column.nullable,
      column.ordinal
    ]),
    historyInsertsVerified:
      dashboard.history_shape_status === "confirmed_t82_text_shape" &&
      dashboard.packets.every((entry) => {
        const packet = readFileSync(
          path.join("supabase/dashboard-packets/s2-t40", entry.packet_file),
          "utf8"
        );
        return packet.includes(
          "insert into supabase_migrations.schema_migrations (version, statements, name)"
        );
      }),
    networkCalls: 0
  };

  validateFinalParity(snapshot);
  const sourceSha = git("rev-parse", "HEAD");
  process.stdout.write("S2_T74_FINAL_PARITY_PASS\n");
  process.stdout.write(`project_ref=${projectRef}\nsource_sha=${sourceSha}\ncli_version=${snapshot.cliVersion}\n`);
  for (const [name, hash] of snapshot.migrations) process.stdout.write(`migration=${name} sha256=${hash}\n`);
  for (const [name, hash] of snapshot.edgeFiles) process.stdout.write(`edge_file=${name} sha256=${hash}\n`);
  process.stdout.write("dashboard_order=0032,0033,0034\nhistory_metadata=confirmed_t82_text_shape\nnetwork_calls=0\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T74_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "STOP_S2_T74_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
}
