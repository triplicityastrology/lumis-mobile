import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONTROL_PATH = "supabase/tests/s2-t140-care-circle-0037-dashboard-control.json";
const OUTPUT_ROOT = "supabase/dashboard-packets/s2-t140";
const mode = process.argv[2];
assert(mode === "--check" || mode === "--write", "S2_T140_MODE_INVALID");

const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
const entry = control.migration;
const source = readFileSync(entry.migration_path, "utf8");
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.history_shape_status, "confirmed_t82_text_shape");
assert.equal(entry.version, "0037");
assert.equal(entry.care_circle_predecessor_version, "0034");
assert.equal(createHash("sha256").update(source).digest("hex"), entry.source_sha256);

const body = executableBody(source);
if (mode === "--write") mkdirSync(OUTPUT_ROOT, { recursive: true });
for (const [filename, commit] of [[entry.packet_file, true], [entry.rehearsal_file, false]]) {
  const expected = buildPacket(commit);
  const output = path.join(OUTPUT_ROOT, filename);
  if (mode === "--write") writeFileSync(output, expected, { encoding: "utf8", mode: 0o600 });
  else assert.equal(readFileSync(output, "utf8"), expected, `S2_T140_PACKET_STALE:${filename}`);
}

process.stdout.write(mode === "--write"
  ? "S2-T140 inert 0037 Dashboard packets generated; no database command ran.\n"
  : "S2-T140 0037 Dashboard packet parity passed; packets remain unrun.\n");

function executableBody(value) {
  const normalized = value.replaceAll("\r\n", "\n").trim();
  assert(normalized.startsWith("begin;\n"), "S2_T140_SOURCE_BEGIN_MISSING");
  assert(normalized.endsWith("\ncommit;"), "S2_T140_SOURCE_COMMIT_MISSING");
  const inner = normalized.slice("begin;\n".length, -"\ncommit;".length);
  assert(!/(^|\n)\s*(?:begin|commit|rollback);/iu.test(inner), "S2_T140_NESTED_TRANSACTION_UNSAFE");
  return inner;
}

function buildPacket(commit) {
  assert(!source.includes("$s2_t140_source$"), "S2_T140_SOURCE_TAG_CONFLICT");
  const expectedHistory = JSON.stringify(localMigrations()
    .filter(({ version }) => version <= "0034")
    .map(({ version, name }) => [version, name])).replaceAll("'", "''");
  const expectedColumns = JSON.stringify(control.history_columns.map((column) => ({
    column_name: column.name, data_type: column.data_type, udt_name: column.udt_name,
    is_nullable: column.nullable, column_default: null, ordinal_position: column.ordinal,
  }))).replaceAll("'", "''");
  const lines = [
    `-- S2-T140 Dashboard ${commit ? "apply packet" : "rollback rehearsal"}: 0037`,
    `-- Approved staging ref: ${control.project_ref}`,
    `-- Exact source SHA-256: ${entry.source_sha256}`,
    "-- SOURCE_ONLY_UNRUN: visually verify the exact Dashboard project before use.",
    "begin;",
    "do $s2_t140_preflight$",
    "declare v_columns jsonb; v_history jsonb;",
    "begin",
    "  select jsonb_agg(jsonb_build_object('column_name',column_name,'data_type',data_type,'udt_name',udt_name,'is_nullable',is_nullable,'column_default',column_default,'ordinal_position',ordinal_position) order by ordinal_position)",
    "    into v_columns from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations';",
    `  if v_columns is distinct from '${expectedColumns}'::jsonb then raise exception 'S2_T140_STOP_HISTORY_SHAPE_MISMATCH' using errcode='P0001'; end if;`,
    "  select coalesce(jsonb_agg(jsonb_build_array(version,name) order by version),'[]'::jsonb) into v_history from supabase_migrations.schema_migrations;",
    `  if v_history is distinct from '${expectedHistory}'::jsonb then raise exception 'S2_T140_STOP_REMOTE_PARITY_MISMATCH' using errcode='P0001'; end if;`,
    `  if not exists (select 1 from supabase_migrations.schema_migrations where version='0034' and name='${entry.care_circle_predecessor_name}') then raise exception 'S2_T140_STOP_0034_REQUIRED' using errcode='P0001'; end if;`,
    "  if to_regclass('public.care_pairing_attempt_windows') is not null or exists (select 1 from supabase_migrations.schema_migrations where version='0037') then raise exception 'S2_T140_STOP_0037_RESIDUE_PRESENT' using errcode='P0001'; end if;",
    "end $s2_t140_preflight$;",
    "-- S2_T140_EXECUTABLE_MIGRATION_BODY_BEGIN",
    body,
    "-- S2_T140_EXECUTABLE_MIGRATION_BODY_END",
    "insert into supabase_migrations.schema_migrations (version, statements, name)",
    `values ('0037',array[$s2_t140_source$${source.trim()}$s2_t140_source$]::text[],'${entry.history_name}');`,
    "do $s2_t140_postcheck$ begin",
    "  if to_regclass('public.care_pairing_attempt_windows') is null or (select count(*) from supabase_migrations.schema_migrations where version='0037' and name='four_digit_care_pairing_codes') <> 1 then raise exception 'S2_T140_STOP_POSTCHECK_FAILED' using errcode='P0001'; end if;",
    "end $s2_t140_postcheck$;",
    commit ? "commit;" : "rollback;",
  ];
  if (!commit) lines.push(
    "do $s2_t140_zero_residue$ begin",
    "  if to_regclass('public.care_pairing_attempt_windows') is not null or exists (select 1 from supabase_migrations.schema_migrations where version='0037') then raise exception 'S2_T140_STOP_REHEARSAL_RESIDUE' using errcode='P0001'; end if;",
    "end $s2_t140_zero_residue$;"
  );
  return `${lines.join("\n")}\n`;
}

function localMigrations() {
  return readdirSync("supabase/migrations")
    .map((filename) => filename.match(/^(\d{4})_([a-z0-9_]+)\.sql$/u))
    .filter(Boolean)
    .map((match) => ({ version: match[1], name: match[2] }))
    .sort((left, right) => left.version.localeCompare(right.version));
}
