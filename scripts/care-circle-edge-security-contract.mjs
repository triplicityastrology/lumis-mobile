import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/care-circle/index.ts", "utf8");
const boundary = readFileSync(
  "supabase/functions/care-circle/operation-boundary.ts",
  "utf8"
);

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

console.log("Care Circle Edge security contract passed");
