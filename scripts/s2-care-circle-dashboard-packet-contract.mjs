import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const control = JSON.parse(
  readFileSync(
    "supabase/tests/s2-t40-care-circle-dashboard-packet-control.json",
    "utf8"
  )
);
const runbook = readFileSync(
  "docs/setup/s2-t09-care-circle-staging-deployment-recovery-runbook.md",
  "utf8"
);
const generator = readFileSync(
  "scripts/s2-care-circle-dashboard-packets.mjs",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.history_shape_status, "confirmed_t82_text_shape");
assert.deepEqual(control.history_columns, [
  { name: "version", data_type: "text", udt_name: "text", nullable: "NO", ordinal: 1 },
  { name: "statements", data_type: "ARRAY", udt_name: "_text", nullable: "YES", ordinal: 2 },
  { name: "name", data_type: "text", udt_name: "text", nullable: "YES", ordinal: 3 }
]);
assert.deepEqual(control.packets.map((entry) => entry.version), [
  "0032",
  "0033",
  "0034"
]);

for (const [index, entry] of control.packets.entries()) {
  const source = readFileSync(entry.migration_path, "utf8").trimEnd();
  const sourceHash = createHash("sha256")
    .update(readFileSync(entry.migration_path))
    .digest("hex");
  assert.equal(sourceHash, entry.source_sha256);
  for (const [file, ending] of [
    [entry.packet_file, "commit"],
    [entry.rehearsal_file, "rollback"]
  ]) {
    const packet = readFileSync(`supabase/dashboard-packets/s2-t40/${file}`, "utf8");
    const extracted = packet.match(
      /-- S2_T40_EXACT_MIGRATION_BODY_BEGIN\n([\s\S]*?)\n-- S2_T40_EXACT_MIGRATION_BODY_END/
    );
    assert.equal(extracted?.[1], source, `${file} body is not byte-stable.`);
    assert(packet.indexOf("begin;") < packet.indexOf("S2_T40_EXACT_MIGRATION_BODY_BEGIN"));
    assert(packet.indexOf("S2_T40_STOP_HISTORY_SHAPE_MISMATCH") < packet.indexOf("S2_T40_EXACT_MIGRATION_BODY_BEGIN"));
    assert(packet.indexOf("S2_T40_STOP_REMOTE_PARITY_MISMATCH") < packet.indexOf("S2_T40_EXACT_MIGRATION_BODY_BEGIN"));
    assert.match(packet, /insert into supabase_migrations\.schema_migrations \(version, statements, name\)/i);
    assert.match(packet, new RegExp(`values \\('${entry.version}'`));
    assert.match(packet, new RegExp(`'${entry.history_name}'\\);`));
    assert.match(packet, new RegExp(`${ending};\\n$`));
    assert.equal((packet.match(/\bbegin;/g) ?? []).length, 1);
    assert.equal((packet.match(/\b(?:commit|rollback);/g) ?? []).length, 1);
    assert.doesNotMatch(packet, /\b0035\b|\b0036\b/);
    for (const prior of control.packets.slice(0, index)) {
      assert.match(packet, new RegExp(`\\[\\"${prior.version}\\",\\"${prior.history_name}\\"\\]`));
    }
    for (const future of control.packets.slice(index)) {
      assert.doesNotMatch(packet, new RegExp(`\\[\\"${future.version}\\",\\"${future.history_name}\\"\\]`));
    }
  }
}

assert.doesNotMatch(
  generator,
  /https?:\/\/|\bfetch\s*\(|supabase\s+(?:db|functions|migration)|child_process.*exec/
);
for (const requirement of [
  "S2-T40 Dashboard Migration Packets",
  "S2_T40_STOP_HISTORY_SHAPE_MISMATCH",
  "0032",
  "0033",
  "0034",
  "rollback rehearsal",
  "history-table shape",
  "Stop before every write"
]) {
  assert(runbook.includes(requirement), `Runbook omits ${requirement}.`);
}

assert.equal(
  packageJson.scripts["test:s2-care-circle-dashboard-packets"],
  "node scripts/s2-care-circle-dashboard-packets.mjs --check && node scripts/s2-care-circle-dashboard-packet-contract.mjs"
);

const parity = spawnSync(
  process.execPath,
  ["scripts/s2-care-circle-dashboard-packets.mjs", "--check"],
  { encoding: "utf8" }
);
assert.equal(parity.status, 0, parity.stderr);
assert.match(parity.stdout, /remain inert and unrun/);

process.stdout.write(
  "S2-T40 Dashboard packet contracts passed; no Dashboard or database operation ran.\n"
);
