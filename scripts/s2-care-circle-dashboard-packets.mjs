import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONTROL_PATH =
  "supabase/tests/s2-t40-care-circle-dashboard-packet-control.json";
const OUTPUT_ROOT = "supabase/dashboard-packets/s2-t40";
const mode = process.argv[2];

assert(
  mode === "--check" || mode === "--write",
  "S2_T40_MODE_MUST_BE_CHECK_OR_WRITE"
);

const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.execution_default, "blocked_source_preparation_only");

if (mode === "--write") mkdirSync(OUTPUT_ROOT, { recursive: true });

for (const entry of control.packets) {
  const source = readFileSync(entry.migration_path, "utf8");
  const checksum = createHash("sha256").update(source).digest("hex");
  assert.equal(checksum, entry.source_sha256, "S2_T40_SOURCE_CHECKSUM_MISMATCH");

  const expected = buildPacket(entry, source);
  const outputPath = path.join(OUTPUT_ROOT, entry.packet_file);
  if (mode === "--write") {
    writeFileSync(outputPath, expected, { encoding: "utf8", mode: 0o600 });
  } else {
    assert.equal(
      readFileSync(outputPath, "utf8"),
      expected,
      `S2_T40_PACKET_STALE:${entry.packet_file}`
    );
  }
}

process.stdout.write(
  mode === "--write"
    ? "S2-T40 blocked Dashboard packets generated locally; no network or database command ran.\n"
    : "S2-T40 Dashboard packet parity passed locally; packets remain blocked and inert.\n"
);

function buildPacket(entry, source) {
  const normalizedSource = source.endsWith("\n") ? source : `${source}\n`;
  return [
    `-- S2-T40 Dashboard packet: ${entry.version}`,
    `-- Approved staging ref: ${control.project_ref}`,
    `-- Exact source: ${entry.migration_path}`,
    `-- Source SHA-256: ${entry.source_sha256}`,
    "-- STATUS: BLOCKED_SOURCE_PREPARATION_ONLY",
    "-- This packet must not be executed until the authorized read-only history",
    "-- shape/parity inspection and a separately reviewed history insert are complete.",
    "",
    "begin;",
    "",
    "do $s2_t40_history_gate$",
    "begin",
    "  raise exception 'S2_T40_STOP_HISTORY_SHAPE_NOT_CONFIRMED'",
    "    using errcode = 'P0001';",
    "end",
    "$s2_t40_history_gate$;",
    "",
    "-- S2_T40_EXACT_MIGRATION_BODY_BEGIN",
    normalizedSource.trimEnd(),
    "-- S2_T40_EXACT_MIGRATION_BODY_END",
    "",
    "-- S2_T40_MIGRATION_HISTORY_RECORD_BLOCKED_BEGIN",
    `-- Required version: ${entry.version}`,
    `-- Required name: ${entry.history_name}`,
    "-- No INSERT is authored here because the live schema_migrations columns",
    "-- have not been confirmed. Guessing that shape is prohibited.",
    "-- S2_T40_MIGRATION_HISTORY_RECORD_BLOCKED_END",
    "",
    "rollback;",
    ""
  ].join("\n");
}
