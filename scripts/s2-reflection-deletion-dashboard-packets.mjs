import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONTROL_PATH = "supabase/tests/s2-t107-reflection-deletion-dashboard-control.json";
const OUTPUT_ROOT = "supabase/dashboard-packets/s2-t107";
const mode = process.argv[2];
assert(mode === "--check" || mode === "--write", "S2_T107_MODE_INVALID");

const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
const entry = control.migration;
const source = readFileSync(entry.migration_path, "utf8");
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.history_shape_status, "confirmed_t82_text_shape");
assert.equal(entry.version, "0036");
assert.equal(entry.required_remote_predecessor_version, "0035");
assert.equal(entry.required_remote_predecessor_name, "app_language_preference");
assert.equal(createHash("sha256").update(source).digest("hex"), entry.source_sha256);

if (mode === "--write") mkdirSync(OUTPUT_ROOT, { recursive: true });
for (const [filename, commit] of [[entry.packet_file, true], [entry.rehearsal_file, false]]) {
  const expected = buildPacket(commit);
  const output = path.join(OUTPUT_ROOT, filename);
  if (mode === "--write") writeFileSync(output, expected, { encoding: "utf8", mode: 0o600 });
  else assert.equal(readFileSync(output, "utf8"), expected, `S2_T107_PACKET_STALE:${filename}`);
}

process.stdout.write(
  mode === "--write"
    ? "S2-T107 inert 0036 Dashboard packets generated locally; no database command ran.\n"
    : "S2-T107 0036 Dashboard packet parity passed; packets remain unrun.\n",
);

function buildPacket(commit) {
  const normalized = source.endsWith("\n") ? source : `${source}\n`;
  assert(!normalized.includes("$s2_t107_source$"), "S2_T107_SOURCE_TAG_CONFLICT");
  const expectedHistory = JSON.stringify(localMigrations().filter((item) => item.version < "0036").map((item) => [item.version, item.name])).replaceAll("'", "''");
  const expectedColumns = JSON.stringify(control.history_columns.map((column) => ({
    column_name: column.name,
    data_type: column.data_type,
    udt_name: column.udt_name,
    is_nullable: column.nullable,
    column_default: null,
    ordinal_position: column.ordinal,
  }))).replaceAll("'", "''");
  return [
    `-- S2-T107 Dashboard ${commit ? "apply packet" : "rollback rehearsal"}: 0036`,
    `-- Approved staging ref: ${control.project_ref}`,
    `-- Exact source: ${entry.migration_path}`,
    `-- Source SHA-256: ${entry.source_sha256}`,
    "-- STATUS: SOURCE_ONLY_UNRUN_REQUIRES_SEPARATE_MANUAL_AUTHORIZATION",
    "-- The operator must independently confirm the Dashboard project ref before use.",
    "",
    "begin;",
    "",
    "do $s2_t107_preflight$",
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
    "   where table_schema = 'supabase_migrations' and table_name = 'schema_migrations';",
    `  if v_columns is distinct from '${expectedColumns}'::jsonb then`,
    "    raise exception 'S2_T107_STOP_HISTORY_SHAPE_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    "  select coalesce(jsonb_agg(jsonb_build_array(version, name) order by version), '[]'::jsonb)",
    "    into v_history from supabase_migrations.schema_migrations;",
    `  if v_history is distinct from '${expectedHistory}'::jsonb then`,
    "    raise exception 'S2_T107_STOP_REMOTE_PARITY_OR_0035_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    `  if not exists (select 1 from supabase_migrations.schema_migrations where version = '${entry.required_remote_predecessor_version}' and name = '${entry.required_remote_predecessor_name}') then`,
    "    raise exception 'S2_T107_STOP_0035_REQUIRED' using errcode = 'P0001';",
    "  end if;",
    "end",
    "$s2_t107_preflight$;",
    "",
    "-- S2_T107_EXACT_MIGRATION_BODY_BEGIN",
    normalized.trimEnd(),
    "-- S2_T107_EXACT_MIGRATION_BODY_END",
    "",
    "insert into supabase_migrations.schema_migrations (version, statements, name)",
    `values ('0036', array[$s2_t107_source$${normalized.trimEnd()}$s2_t107_source$]::text[], '${entry.history_name}');`,
    "",
    "do $s2_t107_postcheck$",
    "begin",
    `  if (select count(*) from supabase_migrations.schema_migrations where version = '0036' and name = '${entry.history_name}') <> 1 then`,
    "    raise exception 'S2_T107_STOP_HISTORY_INSERT_MISMATCH' using errcode = 'P0001';",
    "  end if;",
    "end",
    "$s2_t107_postcheck$;",
    "",
    commit ? "commit;" : "rollback;",
    "",
  ].join("\n");
}

function localMigrations() {
  return readdirSync("supabase/migrations")
    .map((filename) => filename.match(/^(\d{4})_([a-z0-9_]+)\.sql$/u))
    .filter(Boolean)
    .map((match) => ({ version: match[1], name: match[2] }))
    .sort((left, right) => left.version.localeCompare(right.version));
}
