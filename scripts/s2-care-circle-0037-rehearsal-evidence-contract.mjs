import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { validateRehearsalEvidence } from "./lib/care-circle-0037-rehearsal-evidence.mjs";

const valid = JSON.parse(readFileSync("supabase/tests/s2-t158-care-circle-0037-rehearsal-evidence.valid.json", "utf8"));
assert.deepEqual(validateRehearsalEvidence(valid), valid);
const hostile = [
  [{ success: true }, "ENVELOPE_FIELDS_INVALID"],
  [{ ...valid, project_ref: "production" }, "PROJECT_INVALID"],
  [{ ...valid, predecessor_versions: ["0032", "0034"] }, "PREDECESSOR_PARITY_INVALID"],
  [{ ...valid, history_parity: "assumed" }, "HISTORY_PARITY_INVALID"],
  [{ ...valid, migration: { ...valid.migration, sha256: "0".repeat(64) } }, "MIGRATION_INVALID"],
  [{ ...valid, residue: { schema_objects: 1, history_rows: 0 } }, "RESIDUE_NOT_ZERO"],
  [{ ...valid, rollback_result: "claimed" }, "ROLLBACK_NOT_PASSED"],
  [{ ...valid, rows_exposed: true }, "PRIVACY_BOUNDARY_INVALID"],
  [{ ...valid, extra: "passed" }, "ENVELOPE_FIELDS_INVALID"],
  [{ ...valid, project_classification: "https://private.example" }, "PROJECT_INVALID"],
];
for (const [value, code] of hostile) assert.throws(() => validateRehearsalEvidence(value), new RegExp(`STOP_S2_T158_${code}`));

const cli = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-rehearsal-evidence.mjs", "--input", "/missing/private.json"], { encoding: "utf8" });
assert.notEqual(cli.status, 0);
assert.equal(cli.stderr, "S2_T158_RETURNED STOP_S2_T158_ENVELOPE_INVALID\n");
assert.doesNotMatch(cli.stdout + cli.stderr, /missing|private\.json/u);

const windowSource = readFileSync("scripts/s2-care-circle-0037-window.mjs", "utf8");
assert.match(windowSource, /REHEARSAL_RECEIPT_PATH/);
assert.match(windowSource, /REHEARSAL_ENVELOPE_REQUIRED/);
assert.match(windowSource, /s2_t158_care_circle_0037_rehearsal_receipt_v1/);
console.log("S2-T158 closed 0037 rehearsal evidence validator contracts passed.");
