import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  finalParityConstants,
  validateFinalParity
} from "./lib/care-circle-final-parity.mjs";

const valid = {
  projectRef: finalParityConstants.approvedProjectRef,
  cliVersion: finalParityConstants.approvedCliVersion,
  ancestorPresent: true,
  dirtyPaths: [],
  linkedRef: finalParityConstants.approvedProjectRef,
  migrations: structuredClone(finalParityConstants.requiredMigrations),
  dashboardSources: structuredClone(finalParityConstants.requiredMigrations),
  edgeFiles: structuredClone(finalParityConstants.requiredEdgeFiles),
  dashboardPacketVersions: ["0032", "0033", "0034"],
  dashboardPacketParity: true,
  historyColumns: structuredClone(finalParityConstants.requiredHistoryColumns),
  historyInsertsVerified: true,
  networkCalls: 0
};

assert.deepEqual(validateFinalParity(valid), { ok: true });
for (const [name, mutate, code] of [
  ["wrong project", (value) => { value.projectRef = "wrong"; }, "WRONG_PROJECT"],
  ["stale T67", (value) => { value.migrations[0][1] = "0".repeat(64); }, "MIGRATION_CHECKSUM_MISMATCH"],
  ["stale T69", (value) => { value.edgeFiles[0][1] = "0".repeat(64); }, "EDGE_BUNDLE_CHECKSUM_MISMATCH"],
  ["extra 0035 packet", (value) => { value.dashboardPacketVersions.push("0035"); }, "DASHBOARD_ORDER_INVALID"],
  ["history schema drift", (value) => { value.historyColumns[0][1] = "uuid"; }, "HISTORY_METADATA_UNSAFE"],
  ["missing history insert", (value) => { value.historyInsertsVerified = false; }, "HISTORY_INSERT_UNSAFE"],
  ["visual modification", (value) => { value.dirtyPaths.push("apps/mobile/src/theme/tokens.ts"); }, "WORKTREE_NOT_CLEAN"],
  ["network use", (value) => { value.networkCalls = 1; }, "NETWORK_BOUNDARY_VIOLATION"]
]) {
  const fixture = structuredClone(valid);
  mutate(fixture);
  assert.throws(() => validateFinalParity(fixture), new RegExp(`STOP_S2_T74_${code}`), name);
}

const runner = readFileSync("scripts/s2-care-circle-final-parity-preflight.mjs", "utf8");
assert.doesNotMatch(runner, /\bfetch\s*\(|https?:\/\/|supabase\s+(?:db|functions|migration|link)/i);
assert.match(runner, /git\("status", "--porcelain=v1"\)/);
assert.match(runner, /merge-base", "--is-ancestor/);
assert.match(runner, /confirmed_t82_text_shape/);
assert.match(runner, /insert into supabase_migrations\.schema_migrations \(version, statements, name\)/);

process.stdout.write("S2-T74 final parity preflight contracts passed; no network call ran.\n");
