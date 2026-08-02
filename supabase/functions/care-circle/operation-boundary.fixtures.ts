import assert from "node:assert/strict";

import {
  projectSafeCareCircleResponse,
  validateCareCircleRequest
} from "./operation-boundary.ts";

const requestId = "10000000-0000-4000-8000-000000000001";
const relationshipId = "20000000-0000-4000-8000-000000000001";
const codeId = "30000000-0000-4000-8000-000000000001";

assert.equal(validateCareCircleRequest(null).ok, false);
assert.equal(validateCareCircleRequest([]).ok, false);
assert.equal(validateCareCircleRequest({ action: "unknown", client_request_id: requestId }).ok, false);
assert.equal(validateCareCircleRequest({
  action: "care_resume",
  client_request_id: requestId,
  service_role_key: "must-not-be-accepted"
}).ok, false);
assert.equal(validateCareCircleRequest({
  action: "relationship_accept",
  client_request_id: requestId,
  relationship_id: relationshipId,
  pairing_code: "2468"
}).ok, false);
assert.equal(validateCareCircleRequest({
  action: "relationship_accept",
  client_request_id: requestId,
  relationship_id: relationshipId
}).ok, true);

assert.deepEqual(projectSafeCareCircleResponse("relationship_accept", {
  ok: true,
  status: "active",
  idempotent: false,
  relationship_id: relationshipId,
  actor_user_id: "not-projected",
  caree_user_id: "not-projected",
  request_digest: "not-projected",
  database_detail: "not-projected"
}), {
  ok: true,
  status: "active",
  idempotent: false,
  relationship_id: relationshipId
});

assert.deepEqual(projectSafeCareCircleResponse("pairing_code_create", {
  ok: true,
  status: "active",
  idempotent: false,
  code_id: codeId,
  expires_at: "2030-01-01T00:00:00.000Z",
  code_hash: "not-projected"
}, "2468"), {
  ok: true,
  status: "active",
  idempotent: false,
  code_id: codeId,
  expires_at: "2030-01-01T00:00:00.000Z",
  pairing_code: "2468"
});

assert.throws(
  () => projectSafeCareCircleResponse("relationship_accept", {
    ok: true,
    status: "active",
    idempotent: false
  }),
  /CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE/
);
assert.throws(
  () => projectSafeCareCircleResponse("relationship_accept", {
    ok: true,
    status: "administrator",
    idempotent: false,
    relationship_id: relationshipId
  }),
  /CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE/
);
assert.throws(
  () => projectSafeCareCircleResponse("pairing_code_create", {
    ok: true,
    status: "active",
    idempotent: false,
    code_id: codeId,
    expires_at: "2030-01-01T00:00:00.000Z"
  }, "raw-secret"),
  /CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE/
);

console.log("Care Circle Edge operation boundary fixtures passed");
