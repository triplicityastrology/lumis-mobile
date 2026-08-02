import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const control = JSON.parse(readFileSync("supabase/tests/s2-t107-reflection-deletion-dashboard-control.json", "utf8"));
const migration = readFileSync(control.migration.migration_path, "utf8");
assert.equal(createHash("sha256").update(migration).digest("hex"), control.migration.source_sha256);
assert.equal(control.migration.required_remote_predecessor_version, "0035");
assert.equal(control.migration.required_remote_predecessor_name, "app_language_preference");

const check = spawnSync(process.execPath, ["scripts/s2-reflection-deletion-dashboard-packets.mjs", "--check"], { encoding: "utf8" });
assert.equal(check.status, 0, check.stderr);
for (const [file, ending] of [[control.migration.packet_file, "commit;"], [control.migration.rehearsal_file, "rollback;"]]) {
  const packet = readFileSync(`supabase/dashboard-packets/s2-t107/${file}`, "utf8");
  assert.match(packet, /S2_T107_STOP_REMOTE_PARITY_OR_0035_MISMATCH/);
  assert.match(packet, /S2_T107_STOP_0035_REQUIRED/);
  assert.match(packet, /version = '0035' and name = 'app_language_preference'/);
  assert.match(packet, /insert into supabase_migrations\.schema_migrations \(version, statements, name\)/);
  assert.equal((packet.match(/-- S2_T107_EXACT_MIGRATION_BODY_BEGIN/g) ?? []).length, 1);
  assert.ok(packet.trimEnd().endsWith(ending));
  assert.doesNotMatch(packet, /S2_T40_EXACT_MIGRATION_BODY_BEGIN|inactive_notification_foundation\.sql|reusable_care_pairing_operations\.sql|app_language_preference\.sql/);
}

console.log("S2-T107 reflection deletion Dashboard packet contracts passed; no SQL ran.");
