import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
assert.equal(control.execution_default, "inert_source_only_manual_authorization_required");
assert.equal(control.history_shape_status, "confirmed_t82_text_shape");

if (mode === "--write") mkdirSync(OUTPUT_ROOT, { recursive: true });

for (const entry of control.packets) {
  const source = readFileSync(entry.migration_path, "utf8");
  const checksum = createHash("sha256").update(source).digest("hex");
  assert.equal(checksum, entry.source_sha256, "S2_T40_SOURCE_CHECKSUM_MISMATCH");

  for (const [file, commit] of [
    [entry.packet_file, true],
    [entry.rehearsal_file, false]
  ]) {
    const expected = buildPacket(entry, source, commit);
    const outputPath = path.join(OUTPUT_ROOT, file);
    if (mode === "--write") {
      writeFileSync(outputPath, expected, { encoding: "utf8", mode: 0o600 });
    } else {
      assert.equal(
        readFileSync(outputPath, "utf8"),
        expected,
        `S2_T40_PACKET_STALE:${file}`
      );
    }
  }
}

process.stdout.write(
  mode === "--write"
    ? "S2-T40 inert Dashboard packets generated locally; no network or database command ran.\n"
    : "S2-T40 Dashboard packet parity passed locally; packets remain inert and unrun.\n"
);

function buildPacket(entry, source, commit) {
  const normalizedSource = source.endsWith("\n") ? source : `${source}\n`;
  assert(!normalizedSource.includes("$s2_t40_source$"), "S2_T40_SOURCE_TAG_CONFLICT");
  const prior = localMigrations()
    .filter((migration) => Number(migration.version) < Number(entry.version))
    .filter((migration) => Number(migration.version) <= 34);
  const expectedHistory = JSON.stringify(
    prior.map((migration) => [migration.version, migration.name])
  ).replaceAll("'", "''");
  const expectedColumns = JSON.stringify(
    control.history_columns.map((column) => ({
      column_name: column.name,
      data_type: column.data_type,
      udt_name: column.udt_name,
      is_nullable: column.nullable,
      column_default: null,
      ordinal_position: column.ordinal
    }))
  ).replaceAll("'", "''");
  const ending = commit ? "commit;" : "rollback;";
  return [
    `-- S2-T40 Dashboard ${commit ? "apply packet" : "rollback rehearsal"}: ${entry.version}`,
    `-- Approved staging ref: ${control.project_ref}`,
    `-- Exact source: ${entry.migration_path}`,
    `-- Source SHA-256: ${entry.source_sha256}`,
    "-- STATUS: SOURCE_ONLY_UNRUN_REQUIRES_SEPARATE_MANUAL_AUTHORIZATION",
    "-- The SQL transaction cannot prove the Dashboard project ref. The operator",
    "-- must visually confirm the exact approved ref before opening this packet.",
    "",
    "begin;",
    "",
    "do $s2_t40_preflight$",
    "declare",
    "  v_columns jsonb;",
    "  v_history jsonb;",
    "begin",
    "  select jsonb_agg(jsonb_build_object(",
    "      'column_name', column_name, 'data_type', data_type,",
    "      'udt_name', udt_name, 'is_nullable', is_nullable,",
    "      'column_default', column_default, 'ordinal_position', ordinal_position",
    "    ) order by ordinal_position)",
    "    into v_columns",
    "    from information_schema.columns",
    "   where table_schema = 'supabase_migrations'",
    "     and table_name = 'schema_migrations';",
    `  if v_columns is distinct from '${expectedColumns}'::jsonb then`,
    "    raise exception 'S2_T40_STOP_HISTORY_SHAPE_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    "",
    "  select coalesce(jsonb_agg(jsonb_build_array(version, name) order by version), '[]'::jsonb)",
    "    into v_history",
    "    from supabase_migrations.schema_migrations;",
    `  if v_history is distinct from '${expectedHistory}'::jsonb then`,
    "    raise exception 'S2_T40_STOP_REMOTE_PARITY_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    "end",
    "$s2_t40_preflight$;",
    "",
    "-- S2_T40_EXACT_MIGRATION_BODY_BEGIN",
    normalizedSource.trimEnd(),
    "-- S2_T40_EXACT_MIGRATION_BODY_END",
    "",
    "insert into supabase_migrations.schema_migrations (version, statements, name)",
    `values ('${entry.version}', array[$s2_t40_source$${normalizedSource.trimEnd()}$s2_t40_source$]::text[], '${entry.history_name}');`,
    "",
    "do $s2_t40_postcheck$",
    "begin",
    "  if (select count(*) from supabase_migrations.schema_migrations",
    `       where version = '${entry.version}' and name = '${entry.history_name}') <> 1 then`,
    "    raise exception 'S2_T40_STOP_HISTORY_INSERT_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    "end",
    "$s2_t40_postcheck$;",
    "",
    ending,
    ""
  ].join("\n");
}

function localMigrations() {
  return readdirSync("supabase/migrations")
    .map((filename) => {
      const match = filename.match(/^(\d{4})_([a-z0-9_]+)\.sql$/u);
      return match ? { version: match[1], name: match[2] } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.version.localeCompare(right.version));
}
