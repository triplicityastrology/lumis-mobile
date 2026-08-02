import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sql = readFileSync("supabase/tests/s2-t71-dashboard-read-only-evidence.sql", "utf8");
const dashboardPath = "supabase/tests/s2-t71-dashboard-read-only.valid.json";
const contextPath = "supabase/tests/s2-t71-dashboard-context.valid.json";
const transformer = "scripts/s2-care-circle-dashboard-evidence-transformer.mjs";
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const root = mkdtempSync(path.join(tmpdir(), "s2-t71-"));

try {
  assert.match(sql, /begin transaction read only;/i);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i);
  assert.doesNotMatch(
    sql,
    /['"](?:email|user_id|pairing_code|token|secret|password|payload)['"]/i
  );
  for (const count of [
    "legacy_revoked_relationship_count",
    "legacy_code_fingerprint_count",
    "legacy_code_non_sha256_shape_count",
    "legacy_notification_count",
    "legacy_notification_with_body_count"
  ]) assert.match(sql, new RegExp(count));

  const output = path.join(root, "evidence.json");
  const passed = run(dashboardPath, contextPath, output);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stdout, "S2_T71_DASHBOARD_EVIDENCE_READY\n");
  assert.equal(passed.stderr, "");
  const envelope = readFileSync(output, "utf8");
  assert.doesNotMatch(envelope, /@|secret|password|token|pairing_code|user_id/i);

  const raw = JSON.parse(readFileSync(dashboardPath, "utf8"));
  raw.unexpected = "private-value";
  const unsafePath = path.join(root, "unsafe.json");
  writeFileSync(unsafePath, JSON.stringify(raw));
  const unsafe = run(unsafePath, contextPath, path.join(root, "unsafe-output.json"));
  assert.equal(unsafe.status, 1);
  assert.equal(unsafe.stdout, "");
  assert.equal(unsafe.stderr, "STOP_S2_T71_FIELD_SHAPE_INVALID\n");
  assert.doesNotMatch(unsafe.stderr, /private|stack|Error|at file:/i);
  assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-dashboard-read-only/);
  assert.equal(packageJson.scripts["pretest:all-local"], "pnpm test:care-circle-aggregate-static && pnpm test:care-circle-qr");

  process.stdout.write("S2-T71 read-only Dashboard evidence contract passed\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}

function run(dashboard, context, output) {
  return spawnSync(process.execPath, [
    transformer,
    "--dashboard", dashboard,
    "--context", context,
    "--output", output
  ], { encoding: "utf8" });
}
