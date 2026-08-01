import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const APPROVED_REF = "bmqhwofmdgebpcihjlnb";
const VALIDATOR = "scripts/s2-care-circle-dashboard-evidence-validator.mjs";

class TransformStop extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

try {
  const [dashboardPath, contextPath, outputPath] = parseArgs(process.argv.slice(2));
  stopIf(existsSync(outputPath), "OUTPUT_EXISTS");
  const dashboard = parseJson(dashboardPath);
  const context = parseJson(contextPath);

  exactKeys(dashboard, [
    "schema_version", "legacy_counts", "history_columns", "remote_migrations"
  ]);
  stopIf(dashboard.schema_version !== 1, "DASHBOARD_SCHEMA_INVALID");
  exactKeys(context, ["project_ref", "backup", "rollback_rehearsal"]);
  stopIf(context.project_ref !== APPROVED_REF, "PROJECT_REF_MISMATCH");

  const expectedMigrations = localMigrations().filter(({ version }) => Number(version) < 32);
  stopIf(!Array.isArray(dashboard.remote_migrations), "REMOTE_PARITY_INVALID");
  for (const migration of dashboard.remote_migrations) {
    exactKeys(migration, ["version", "name"]);
    stopIf(
      typeof migration.version !== "string"
        || typeof migration.name !== "string"
        || !/^\d{4}$/u.test(migration.version)
        || !/^[a-z0-9_]+$/u.test(migration.name),
      "REMOTE_PARITY_INVALID"
    );
  }
  stopIf(
    JSON.stringify(dashboard.remote_migrations) !== JSON.stringify(expectedMigrations),
    "REMOTE_PARITY_INVALID"
  );

  const envelope = {
    schema_version: 1,
    project_ref: context.project_ref,
    backup: context.backup,
    legacy_counts: dashboard.legacy_counts,
    history_columns: dashboard.history_columns,
    remote_migration_versions: expectedMigrations.map(({ version }) => version),
    pending_migration_versions: ["0032", "0033", "0034"],
    rollback_rehearsal: context.rollback_rehearsal
  };

  writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  const validation = spawnSync(process.execPath, [VALIDATOR, outputPath], {
    encoding: "utf8"
  });
  if (validation.status !== 0) {
    throw new TransformStop("ENVELOPE_REJECTED");
  }
  process.stdout.write("S2_T71_DASHBOARD_EVIDENCE_READY\n");
} catch (error) {
  const code = error instanceof TransformStop ? error.code : "INPUT_INVALID";
  process.stderr.write(`STOP_S2_T71_${code}\n`);
  process.exitCode = 1;
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

function parseArgs(values) {
  stopIf(values.length !== 6, "ARGUMENTS_INVALID");
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    stopIf(!["--dashboard", "--context", "--output"].includes(flag), "ARGUMENTS_INVALID");
    stopIf(Object.hasOwn(parsed, flag), "ARGUMENTS_INVALID");
    parsed[flag] = value;
  }
  return [parsed["--dashboard"], parsed["--context"], parsed["--output"]];
}

function parseJson(path) {
  stopIf(typeof path !== "string" || !path, "ARGUMENTS_INVALID");
  return JSON.parse(readFileSync(path, "utf8"));
}

function exactKeys(value, expected) {
  stopIf(value === null || typeof value !== "object" || Array.isArray(value), "FIELD_SHAPE_INVALID");
  stopIf(
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort()),
    "FIELD_SHAPE_INVALID"
  );
}

function stopIf(condition, code) {
  if (condition) throw new TransformStop(code);
}
