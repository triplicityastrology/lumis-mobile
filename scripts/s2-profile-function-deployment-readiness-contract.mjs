import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const control = JSON.parse(readFileSync("supabase/tests/s2-t106-profile-function-deployment-control.json", "utf8"));
const operator = readFileSync("scripts/run-s2-profile-function-deploy.zsh", "utf8");
const profile = readFileSync(control.function_path);

assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.function_name, "profile");
assert.equal(createHash("sha256").update(profile).digest("hex"), control.function_sha256);
assert.equal(control.recovery_mode, "redeploy_same_reviewed_live_worker_package_only");
assert.deepEqual(control.required_configuration_names, [
  "CHART_WORKER_SIGNING_SECRET", "CHART_WORKER_URL", "LUMIS_ENV",
  "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL",
]);
for (const file of control.supporting_files) {
  assert.equal(createHash("sha256").update(readFileSync(file.path)).digest("hex"), file.sha256);
}
assert.match(operator, /READY_FOR_PROFILE_PAT|s2-profile-function-deployment-readiness/);
assert.match(operator, /functions deploy "\$FUNCTION_NAME"/);
assert.match(operator, /PREVIOUS_VERSION_CAPTURE_FAILED/);
assert.match(operator, /CURRENT_VERSION.*-gt.*PREVIOUS_VERSION/);
assert.match(operator, /recovery deliberately redeploys this same checksum-pinned package/i);
assert.match(operator, /stty -echo/);
assert.match(operator, /trap cleanup_token EXIT HUP INT TERM/);
assert.match(operator, /classify-supabase-pat-revocation/);
assert.doesNotMatch(operator, /supabase login|functions deploy (?!"\$FUNCTION_NAME")/);

const preflight = spawnSync("zsh", ["scripts/run-s2-profile-function-deploy.zsh"], { encoding: "utf8" });
if (preflight.status === 0) {
  assert.match(preflight.stdout, /READY_FOR_PROFILE_PAT/);
  assert.match(preflight.stdout, /network_calls=0 token_requested=0 deployment_actions=0/);
} else {
  assert.equal(preflight.status, 1);
  assert.equal(preflight.stderr, "STOP_S2_T106_TREE_DIRTY\n");
  assert.equal(preflight.stdout, "");
}

console.log("S2-T106 Profile function deployment readiness passed; no PAT or network was used.");
