import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const wrapper = readFileSync("scripts/run-care-circle-0037-four-digit.sh", "utf8");
const docker = readFileSync("scripts/run-care-circle-0037-docker.sh", "utf8");
const local = readFileSync("scripts/run-care-circle-0037-local.sh", "utf8");
for (const source of [docker, local]) {
  for (const migration of ["0032_care_circle_backend_foundation.sql", "0033_inactive_notification_foundation.sql", "0034_reusable_care_pairing_operations.sql", "0037_four_digit_care_pairing_codes.sql"]) assert.match(source, new RegExp(migration));
  assert.match(source, /S2_T139_FOUR_DIGIT_TRANSACTION_PASSED/);
  assert.match(source, /S2_T139_CONCURRENT_THROTTLE_PASSED/);
  assert.match(source, /allowed.*5/s);
  assert.match(source, /throttled.*1/s);
  assert.doesNotMatch(source, /--linked|project-ref|supabase\.co|curl|wget/);
}
assert.match(docker, /--network none/);
assert.match(docker, /docker image inspect/);
assert.match(local, /--auth-host=reject/);
assert.match(local, /-h ''/);
assert.match(local, /PostgreSQL\\\) 17\\\./);
assert.match(wrapper, /REMOTE_OR_EXISTING_DATABASE_CONTEXT_PRESENT/);
assert.match(wrapper, /ISOLATED_POSTGRES17_UNAVAILABLE/);
assert.match(wrapper, /S2_T148_ENGINE/);

const unsafe = spawnSync("bash", ["scripts/run-care-circle-0037-four-digit.sh"], {
  encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://forbidden.invalid/db" },
});
assert.notEqual(unsafe.status, 0);
assert.match(unsafe.stderr, /^STOP_S2_T148_REMOTE_OR_EXISTING_DATABASE_CONTEXT_PRESENT\n$/u);
assert.doesNotMatch(unsafe.stdout + unsafe.stderr, /postgresql:\/\//u);
console.log("S2-T148 portable PostgreSQL 17 proof contracts passed.");
