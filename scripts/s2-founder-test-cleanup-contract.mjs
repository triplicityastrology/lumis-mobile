import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const control = JSON.parse(readFileSync("supabase/tests/s2-t108-founder-test-cleanup-control.json", "utf8"));
const wrapper = readFileSync("scripts/run-s2-founder-test-cleanup.zsh", "utf8");
const operator = readFileSync("scripts/s2-care-circle-two-account-operator.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.execution_default, "local_validation_only");
assert.deepEqual(control.unsupported_scopes.map((item) => item.scope), [
  "standalone_staging_reflections_or_charts",
  "device_local_demo_artifacts",
]);
assert.match(wrapper, /stty -echo/);
assert.match(wrapper, /--execute --action cleanup/);
assert.match(wrapper, /unsupported_no_safe_authority/);
assert.match(wrapper, /unsupported_use_in_app_owner_flow/);
assert.match(wrapper, /trap cleanup_environment EXIT HUP INT TERM/);
assert.doesNotMatch(wrapper, /\.delete\(|delete from|truncate|supabase login/i);
assert.doesNotMatch(wrapper, /(?:>|>>)\s*(?!\/dev\/(?:tty|null)\b)[A-Za-z_.~]|tee |set -x|printenv|\.env/);
for (const table of ["chat_threads", "chat_messages", "ai_profiles", "birth_data", "birth_data_history"]) {
  assert.match(operator, new RegExp(`\\["${table}", \\["user_id"\\]\\]`));
}
assert.doesNotMatch(operator, /\.from\(["'](?:chat_threads|ai_profiles|birth_data)["']\)\.delete/);
assert.equal(packageJson.scripts["founder-test:cleanup"], "zsh scripts/run-s2-founder-test-cleanup.zsh");

const preflight = spawnSync("zsh", ["scripts/run-s2-founder-test-cleanup.zsh"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /READY_FOR_FOUNDER_TEST_CLEANUP_KEY/);
assert.match(preflight.stdout, /network_calls=0 credentials_requested=0 rows_changed=0/);
assert.doesNotMatch(preflight.stdout + preflight.stderr, /@|https?:\/\/|sb_secret_|password|token/i);

console.log("S2-T108 Founder test cleanup contracts passed; default mode remained inert.");
