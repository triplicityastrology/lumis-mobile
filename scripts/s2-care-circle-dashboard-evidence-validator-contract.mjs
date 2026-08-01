import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = "scripts/s2-care-circle-dashboard-evidence-validator.mjs";
const validPath = "supabase/tests/s2-t45-dashboard-evidence.valid.json";
const source = readFileSync(script, "utf8");
const valid = JSON.parse(readFileSync(validPath, "utf8"));
const root = mkdtempSync(path.join(tmpdir(), "s2-t45-"));

try {
  const passed = run(validPath);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stdout, "S2_T45_DASHBOARD_EVIDENCE_PASS\n");
  assert.equal(passed.stderr, "");

  for (const [name, mutate, expected] of [
    ["wrong-project", (value) => (value.project_ref = "wrong"), "PROJECT_REF_MISMATCH"],
    ["raw-row", (value) => (value.database_rows = [{ value: "private" }]), "FORBIDDEN_FIELD"],
    ["extra", (value) => (value.note = "free text"), "FIELD_SHAPE_INVALID"],
    ["revoked", (value) => (value.legacy_counts.legacy_revoked_relationship_count = 1), "LEGACY_REVOKED_ROWS_PRESENT"],
    ["bad-sha-count", (value) => (value.legacy_counts.legacy_code_non_sha256_shape_count = 1), "LEGACY_FINGERPRINT_INVALID"],
    ["duplicate-history-column", (value) => (value.history_columns[1].column_name = "version"), "HISTORY_SHAPE_INVALID"],
    ["later-migration", (value) => value.remote_migration_versions.push("0035"), "REMOTE_PARITY_INVALID"],
    ["bad-order", (value) => value.pending_migration_versions.reverse(), "PENDING_ORDER_INVALID"],
    ["rollback", (value) => (value.rollback_rehearsal.persisted_change_count = 1), "ROLLBACK_REHEARSAL_UNVERIFIED"]
  ]) {
    const specimen = structuredClone(valid);
    mutate(specimen);
    const specimenPath = path.join(root, `${name}.json`);
    writeFileSync(specimenPath, JSON.stringify(specimen));
    const result = run(specimenPath);
    assert.equal(result.status, 1, name);
    assert.equal(result.stdout, "", name);
    assert.equal(result.stderr, `STOP_S2_T45_${expected}\n`, name);
    assert.doesNotMatch(result.stderr, /private|wrong|0035|stack|Error|at file:/i);
  }

  assert.doesNotMatch(source, /fetch\s*\(|https?:\/\/|child_process|supabase\s+(?:db|migration|functions)/i);
  assert.match(source, /FORBIDDEN_KEY/);
  assert.match(source, /EXPECTED_PENDING = \["0032", "0033", "0034"\]/);
  process.stdout.write("S2-T45 Dashboard evidence validator contracts passed; no network or database command ran.\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}

function run(file) {
  return spawnSync(process.execPath, [script, file], { encoding: "utf8" });
}
