import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { createTrustedSession, validateRehearsalEvidence } from "./lib/care-circle-0037-rehearsal-evidence.mjs";

const valid = JSON.parse(readFileSync("supabase/tests/s2-t158-care-circle-0037-rehearsal-evidence.valid.json", "utf8"));
const session = createTrustedSession(valid.attestation.session_nonce);
assert.deepEqual(validateRehearsalEvidence(valid, session), valid);
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
for (const [value, code] of hostile) assert.throws(() => validateRehearsalEvidence(value, session), new RegExp(`STOP_S2_T158_${code}`));
assert.throws(() => validateRehearsalEvidence(valid), /STOP_S2_T158_ATTESTATION_REQUIRED/);
assert.throws(() => validateRehearsalEvidence(valid, { ...session, consumed: true, status: "consumed" }), /STOP_S2_T158_ATTESTATION_REPLAYED/);
assert.throws(() => validateRehearsalEvidence({ ...valid, attestation: { ...valid.attestation, session_nonce: "b".repeat(64) } }, session), /STOP_S2_T158_ATTESTATION_NONCE_INVALID/);
assert.throws(() => validateRehearsalEvidence({ ...valid, attestation: { ...valid.attestation, operator_sha256: "0".repeat(64) } }, session), /STOP_S2_T158_ATTESTATION_INVALID/);

const cli = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-rehearsal-evidence.mjs", "--input", "/missing/private.json"], { encoding: "utf8" });
assert.notEqual(cli.status, 0);
assert.equal(cli.stderr, "S2_T158_RETURNED STOP_S2_T158_ATTESTATION_REQUIRED\n");
assert.doesNotMatch(cli.stdout + cli.stderr, /missing|private\.json/u);
const inert = spawnSync(process.execPath, ["scripts/s2-care-circle-0037-rehearsal-evidence.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.match(inert.stdout, /WAITING_FOR_TRUSTED_S2_T164_REHEARSAL_SESSION/);
const intakeSource = readFileSync("scripts/s2-care-circle-0037-rehearsal-evidence.mjs", "utf8");
assert.match(intakeSource, /verifyOperatorSource\(\)/u);
assert.match(intakeSource, /0037_four_digit_care_pairing_codes\.rehearsal\.sql/u);

const windowSource = readFileSync("scripts/s2-care-circle-0037-window.mjs", "utf8");
assert.match(windowSource, /REHEARSAL_RECEIPT_PATH/);
assert.match(windowSource, /REHEARSAL_ENVELOPE_REQUIRED/);
assert.match(windowSource, /s2_t158_care_circle_0037_rehearsal_receipt_v1/);
assert.match(windowSource, /attestation_digest/);
console.log("S2-T164 trusted 0037 rehearsal evidence attestation contracts passed.");
