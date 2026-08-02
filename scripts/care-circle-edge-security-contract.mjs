import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/care-circle/index.ts", "utf8");
const boundary = readFileSync(
  "supabase/functions/care-circle/operation-boundary.ts",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(edge, /userClient\.auth\.getUser\(\)/);
assert.match(edge, /p_actor_user_id: actorUserId/);
assert.match(edge, /validateCareCircleRequest\(body\)/);
assert.match(edge, /projectSafeCareCircleResponse/);
assert.doesNotMatch(edge, /console\.(?:log|error|warn)|JSON\.stringify\(body\)/);
assert.match(boundary, /Object\.keys\(body\).*allowedKeys/);
assert.match(boundary, /SAFE_STATUSES/);
assert.match(boundary, /CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE/);
assert.doesNotMatch(
  boundary,
  /response\.(?:actor_user_id|caree_user_id|carer_user_id|request_digest|code_hash|metadata)/
);
assert.match(packageJson.scripts["test:care-circle-edge-security"], /operation-boundary\.fixtures/);
assert.match(packageJson.scripts["test:care-circle-regression-static"], /test:care-circle-edge-security/);
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:care-circle-regression-static/);
assert.equal(packageJson.scripts["pretest:all-local"], "pnpm test:care-circle-aggregate-static && pnpm test:care-circle-qr");

console.log("Care Circle Edge security contract passed");
