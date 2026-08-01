import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-care-circle-local-db-integration.sh", "utf8");
const proof = readFileSync("supabase/tests/s2-t64-care-circle-local-integration.sql", "utf8");
const migration0032 = readFileSync("supabase/migrations/0032_care_circle_backend_foundation.sql", "utf8");

assert.match(runner, /STOP_S2_T64_REMOTE_CREDENTIAL_PRESENT/);
assert.doesNotMatch(runner, /--linked|project-ref|supabase\.co|curl|wget/);
assert.match(runner, /0032_care_circle_backend_foundation\.sql[\s\S]+0033_inactive_notification_foundation\.sql[\s\S]+0034_reusable_care_pairing_operations\.sql/);
assert.match(runner, /docker image inspect/);
assert.match(runner, /trap cleanup EXIT INT TERM/);
for (const invariant of [
  "S2_T64_PENDING_AUTHORITY_VIOLATION", "S2_T64_CAREE_ONLY_ACCEPTANCE_FAILED",
  "S2_T64_SIXTH_CARER_ACCEPTED", "S2_T64_PAUSE_NOT_PERSISTED",
  "S2_T64_RESUME_NOT_PERSISTED", "S2_T64_REMOVAL_NOT_CONFIRMED",
  "S2_T64_CROSS_USER_PROJECTION_LEAK"
]) assert.match(proof, new RegExp(invariant));
for (const operation of [
  "create_care_pairing_code_backend", "consume_care_pairing_code_backend",
  "accept_care_relationship_backend", "update_care_pause_backend",
  "remove_care_relationship_backend"
]) assert.match(proof, new RegExp(`public\\.${operation}`));
assert.match(proof, /rollback;/);
assert.doesNotMatch(proof, /@|https?:\/\//i);
assert.match(migration0032, /retention_until timestamptz generated always as \([\s\S]+expires_at \+ interval '90 days'/);
console.log("Care Circle local database integration contract passed");
