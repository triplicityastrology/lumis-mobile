import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const control = JSON.parse(readFileSync("config/s2-t84-reflection-deletion-readiness.json", "utf8"));
const expectedKeys = ["execution_available", "migration", "prewrite_history_shape_status", "project_ref", "required_remote_predecessor", "schema_version"];
stopUnless(JSON.stringify(Object.keys(control).sort()) === JSON.stringify(expectedKeys), "CONTROL_SHAPE_INVALID");
stopUnless(control.schema_version === 1, "CONTROL_VERSION_INVALID");
stopUnless(control.project_ref === "bmqhwofmdgebpcihjlnb", "PROJECT_REF_MISMATCH");
stopUnless(control.required_remote_predecessor === "0035", "MIGRATION_ORDER_INVALID");
stopUnless(control.execution_available === false, "EXECUTION_MUST_REMAIN_BLOCKED");
stopUnless(control.prewrite_history_shape_status === "blocked_pending_text_type_review", "HISTORY_GATE_INVALID");
stopUnless(control.migration?.version === "0036", "MIGRATION_VERSION_INVALID");
stopUnless(control.migration.path === "supabase/migrations/0036_owner_safe_reflection_deletion.sql", "MIGRATION_PATH_INVALID");

const migration = readFileSync(control.migration.path);
const digest = createHash("sha256").update(migration).digest("hex");
stopUnless(digest === control.migration.sha256, "MIGRATION_CHECKSUM_MISMATCH");

process.stdout.write(`S2_T84_REFLECTION_DELETION_READINESS_PASS\nmigration=0036\nsha256=${digest}\nexecution_available=false\n`);

function stopUnless(condition, code) {
  if (!condition) {
    process.stderr.write(`STOP_S2_T84_${code}\n`);
    process.exit(1);
  }
}
