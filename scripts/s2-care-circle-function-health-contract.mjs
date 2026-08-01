import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  classifyCareCircleHealthFailure,
  classifyCareCircleHealthResponse,
} from "./lib/care-circle-function-health.mjs";

assert.deepEqual(
  classifyCareCircleHealthResponse({
    check: "unauthenticated",
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "safe" } }),
  }),
  { ok: true, check: "unauthenticated_rejection", code: "PASS" }
);
assert.deepEqual(
  classifyCareCircleHealthResponse({
    check: "malformed",
    status: 409,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ error: { code: "48012", message: "safe" } }),
  }),
  { ok: true, check: "malformed_request_rejection", code: "PASS" }
);

for (const [input, code] of [
  [{ check: "unauthenticated", status: 404, contentType: "application/json", body: "{}" }, "FUNCTION_UNAVAILABLE"],
  [{ check: "unauthenticated", status: 401, contentType: "text/html", body: "private" }, "UNSAFE_RESPONSE"],
  [{ check: "unauthenticated", status: 401, contentType: "application/json", body: "not-json" }, "UNSAFE_RESPONSE"],
  [{ check: "unauthenticated", status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "WRONG", message: "safe" } }) }, "AUTH_DENIAL_UNCONFIRMED"],
  [{ check: "malformed", status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "safe" } }) }, "MALFORMED_REJECTION_UNCONFIRMED"],
]) {
  const result = classifyCareCircleHealthResponse(input);
  assert.equal(result.ok, false);
  assert.equal(result.code, `STOP_S2_T104_${code}`);
}
assert.equal(classifyCareCircleHealthFailure("network").code, "STOP_S2_T104_NETWORK_ERROR");

const runner = readFileSync("scripts/s2-care-circle-function-health.mjs", "utf8");
const wrapper = readFileSync("scripts/run-s2-care-circle-function-health.zsh", "utf8");
assert.match(runner, /READY_FOR_DEPLOYED_FUNCTION_HEALTH/);
assert.match(runner, /deployedSha256 === checksum/);
assert.match(runner, /S2_T104_DISPOSABLE_ACCESS_TOKEN/);
assert.match(wrapper, /stty -echo/);
assert.match(wrapper, /unset S2_T104_DISPOSABLE_ACCESS_TOKEN/);
assert.doesNotMatch(runner, /console\.|error\.message|response\.body|process\.stdout\.write\([^)]*endpoint/);
assert.doesNotMatch(wrapper, /tee |set -x|printenv|\.env|pbcopy/);

const preflight = spawnSync(
  process.execPath,
  ["scripts/s2-care-circle-function-health.mjs", "--project-ref", "bmqhwofmdgebpcihjlnb"],
  { encoding: "utf8" }
);
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /^READY_FOR_DEPLOYED_FUNCTION_HEALTH/m);
assert.match(preflight.stdout, /network_calls=0 credentials_requested=0/);
assert.doesNotMatch(preflight.stdout + preflight.stderr, /https?:\/\/|token|endpoint|body/i);

process.stdout.write(
  "S2-T104 function health contracts passed; no network request ran.\n"
);
