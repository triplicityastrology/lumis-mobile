import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const control = JSON.parse(readFileSync("supabase/tests/s2-t140-care-circle-0037-dashboard-control.json", "utf8"));
const generator = readFileSync("scripts/s2-care-circle-0037-dashboard-packets.mjs", "utf8");
const source = readFileSync(control.migration.migration_path, "utf8");
const note = readFileSync("docs/qa/S2-T140-care-circle-0037-dashboard-readiness.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.migration.source_sha256, createHash("sha256").update(source).digest("hex"));
assert.equal(control.migration.care_circle_predecessor_version, "0034");
assert.deepEqual(control.history_columns.map(({ name, data_type }) => [name, data_type]), [["version", "text"], ["statements", "ARRAY"], ["name", "text"]]);

for (const [filename, ending] of [[control.migration.packet_file, "commit;"], [control.migration.rehearsal_file, "rollback;"]]) {
  const packet = readFileSync(`supabase/dashboard-packets/s2-t140/${filename}`, "utf8");
  assert.match(packet, /Approved staging ref: bmqhwofmdgebpcihjlnb/);
  assert.match(packet, /S2_T140_STOP_HISTORY_SHAPE_MISMATCH/);
  assert.match(packet, /S2_T140_STOP_REMOTE_PARITY_MISMATCH/);
  assert.match(packet, /S2_T140_STOP_0034_REQUIRED/);
  assert.match(packet, /S2_T140_EXECUTABLE_MIGRATION_BODY_BEGIN/);
  assert.match(packet, /values \('0037',array\[\$s2_t140_source\$/);
  assert.equal((packet.match(/^begin;$/gmu) ?? []).length, 1);
  assert.equal((packet.match(/^commit;$/gmu) ?? []).length, ending === "commit;" ? 1 : 0);
  assert.equal((packet.match(/^rollback;$/gmu) ?? []).length, ending === "rollback;" ? 1 : 0);
  assert.doesNotMatch(packet, /0035_.*\.sql|0036_.*\.sql|S2_T107_EXACT/);
}
const rehearsal = readFileSync(`supabase/dashboard-packets/s2-t140/${control.migration.rehearsal_file}`, "utf8");
assert.ok(rehearsal.indexOf("rollback;") < rehearsal.indexOf("S2_T140_STOP_REHEARSAL_RESIDUE"));
assert.doesNotMatch(generator, /https?:\/\/|\bfetch\s*\(|supabase\s+(?:db|functions|migration)/);
assert.match(note, /0032.*0033.*0034/);
assert.match(note, /zero schema and history residue/i);
assert.equal(packageJson.scripts["test:s2-care-circle-0037-dashboard-packets"], "node scripts/s2-care-circle-0037-dashboard-packets.mjs --check && node scripts/s2-care-circle-0037-dashboard-packet-contract.mjs");
const check = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-dashboard-packets.mjs", "--check"], { encoding: "utf8" });
assert.equal(check.status, 0, check.stderr);
assert.match(check.stdout, /remain unrun/);
process.stdout.write("S2-T140 0037 Dashboard packet contract passed; no network or database command ran.\n");
