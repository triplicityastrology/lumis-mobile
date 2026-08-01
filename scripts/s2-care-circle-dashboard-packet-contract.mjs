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
assert.equal(control.history_shape_status, "pending_authorized_read_only_inspection");
assert.deepEqual(control.packets.map((entry) => entry.version), [
  "0032",
  "0033",
  "0034"
]);

for (const entry of control.packets) {
  const source = readFileSync(entry.migration_path, "utf8").trimEnd();
  const sourceHash = createHash("sha256")
    .update(readFileSync(entry.migration_path))
    .digest("hex");
  const packet = readFileSync(
    `supabase/dashboard-packets/s2-t40/${entry.packet_file}`,
    "utf8"
  );
  const extracted = packet.match(
    /-- S2_T40_EXACT_MIGRATION_BODY_BEGIN\n([\s\S]*?)\n-- S2_T40_EXACT_MIGRATION_BODY_END/
  );

  assert.equal(sourceHash, entry.source_sha256);
  assert.equal(extracted?.[1], source, `${entry.version} body is not byte-stable.`);
  assert(packet.indexOf("begin;") < packet.indexOf("S2_T40_EXACT_MIGRATION_BODY_BEGIN"));
  assert(
    packet.indexOf("S2_T40_STOP_HISTORY_SHAPE_NOT_CONFIRMED")
      < packet.indexOf("S2_T40_EXACT_MIGRATION_BODY_BEGIN")
  );
  assert.match(packet, new RegExp(`Required version: ${entry.version}`));
  assert.match(packet, new RegExp(`Required name: ${entry.history_name}`));
  assert.match(packet, /rollback;\n$/);
  assert.doesNotMatch(packet, /\bcommit\s*;/i);

  const executableLines = packet
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(
    executableLines,
    /insert\s+into\s+supabase_migrations\.schema_migrations/i
  );
}

assert.doesNotMatch(
  generator,
  /https?:\/\/|\bfetch\s*\(|supabase\s+(?:db|functions|migration)|child_process.*exec/
);
for (const requirement of [
  "S2-T40 Dashboard Migration Packets",
  "S2_T40_STOP_HISTORY_SHAPE_NOT_CONFIRMED",
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
assert.match(parity.stdout, /remain blocked and inert/);

process.stdout.write(
  "S2-T40 Dashboard packet contracts passed; no Dashboard or database operation ran.\n"
);
