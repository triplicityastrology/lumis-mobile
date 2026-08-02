import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validatePersonaLegacyAuditEvidence, EXPECTED_PACKET_SHA256 } from "./lib/persona-legacy-audit-evidence.mjs";

const packet = readFileSync("supabase/dashboard-packets/s2-t161/persona_legacy_selection_read_only.sql", "utf8");
assert.equal(createHash("sha256").update(packet).digest("hex"), EXPECTED_PACKET_SHA256);
assert.match(packet, /begin transaction read only;/iu);
assert.match(packet, /rollback;/iu);
assert.doesNotMatch(packet, /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/iu);
assert.doesNotMatch(packet, /\b(id|email|timestamp|payload|birth|message_body)\b/iu);

const valid = JSON.parse(readFileSync("supabase/tests/s2-t161-persona-legacy-audit.valid.json", "utf8"));
assert.deepEqual(validatePersonaLegacyAuditEvidence(valid), { ok: true, status: "S2_T161_EVIDENCE_ACCEPTED", migrationAuthorized: false });

for (const mutate of [
  (value) => ({ ...value, user_rows: [] }),
  (value) => ({ ...value, project_ref: "wrong" }),
  (value) => ({ ...value, migration_authorized: true }),
  (value) => ({ ...value, packet_sha256: "0".repeat(64) }),
  (value) => ({ ...value, boundaries: [...value.boundaries, { boundary_name: "raw_labels" }] }),
  (value) => ({ ...value, boundaries: value.boundaries.map((entry, index) => index ? entry : { ...entry, unknown_label_only_records: "private-label" }) }),
]) {
  const result = validatePersonaLegacyAuditEvidence(mutate(structuredClone(valid)));
  assert.equal(result.ok, false);
  assert.match(result.code, /^STOP_S2_T161_[A-Z0-9_]+$/u);
  assert.doesNotMatch(result.code, /private|wrong|label/iu);
}

const inert = spawnSync(process.execPath, ["scripts/s2-persona-legacy-audit-evidence.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.match(inert.stdout, /WAITING_FOR_S2_T161_READ_ONLY_EVIDENCE/);
assert.match(inert.stdout, /network_calls=0 sql_executed=false migration_authorized=false/);

console.log("S2-T161 Persona legacy selection audit packet remains count-only, read-only, and inert.");

