import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync(
  "supabase/functions/care-circle/index.ts",
  "utf8"
);
const operationBoundary = readFileSync(
  "supabase/functions/care-circle/operation-boundary.ts",
  "utf8"
);
const migration = readFileSync(
  "supabase/migrations/0034_reusable_care_pairing_operations.sql",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const mobileApp = readFileSync("apps/mobile/App.tsx", "utf8");
const fixtures = JSON.parse(
  readFileSync(
    "supabase/functions/care-circle/care-circle.operations.fixtures.json",
    "utf8"
  )
);

assert.match(edge, /userClient\.auth\.getUser\(\)/);
assert.match(edge, /CARE_CIRCLE_PAIRING_SECRET/);
assert.match(edge, /pairingSecret\.length < 32/);
assert.match(edge, /HMAC/);
assert.match(edge, /SHA-256/);
assert.match(edge, /pairing-code-display/);
assert.match(edge, /pairing-code-fingerprint/);
assert.match(edge, /client_request_id/);
assert.doesNotMatch(edge, /body!?\??\.request_digest/);
assert.doesNotMatch(
  edge,
  /console\.(?:log|error|warn)|JSON\.stringify\(body\)|JSON\.stringify\(request\)/i
);

for (const action of [
  "pairing_code_create",
  "pairing_code_revoke",
  "pairing_code_submit",
  "relationship_accept",
  "relationship_decline",
  "care_pause",
  "care_resume",
  "relationship_remove"
]) {
  assert.match(`${edge}\n${operationBoundary}`, new RegExp(`"${action}"`));
}

for (const rpc of [
  "create_care_pairing_code_backend",
  "revoke_care_pairing_code_backend",
  "consume_care_pairing_code_backend",
  "accept_care_relationship_backend",
  "decline_care_relationship_backend",
  "update_care_pause_backend",
  "remove_care_relationship_backend"
]) {
  assert.match(edge, new RegExp(`"${rpc}"`));
}

for (const code of [48004, 48005, 48006, 48007, 48009, 48012, 48013]) {
  assert.match(edge, new RegExp(`"${code}"`));
}

assert.match(edge, /projectSafeCareCircleResponse/);
assert.match(operationBoundary, /response\.pairing_code = pairingCode/);
assert.doesNotMatch(
  extractFunction(operationBoundary, "projectSafeCareCircleResponse"),
  /code_hash|request_digest|actor_user_id|caree_user_id|carer_user_id|metadata/
);
assert.doesNotMatch(
  edge,
  /invitation|invite|emergency|urgent|billing|entitlement|notification|scheduler/i
);
assert.doesNotMatch(
  edge,
  /fetch\([^)]*(?:expo|apple|google|fcm|apns)/i
);
assert.doesNotMatch(
  mobileApp,
  /functions\.invoke\(\s*["']care-circle["']|pairing_code_(?:create|submit|revoke)/i
);

assert.match(migration, /status = 'active'[\s\S]+expires_at > now\(\)[\s\S]+for update/i);
assert.match(migration, /if v_active_count >= 5/i);
assert.match(migration, /caree_user_id = p_actor_user_id/);
assert.match(migration, /carer_user_id = p_actor_user_id/);
assert.match(migration, /on delete cascade/);
assert.match(migration, /from public, anon, authenticated/);

const caseById = new Map(fixtures.cases.map((fixture) => [fixture.id, fixture]));
for (const requiredCase of [
  "anonymous_rejected",
  "caree_owner_creates_reusable_pairing_code",
  "same_request_replays",
  "changed_payload_same_request_conflicts",
  "carer_creates_pending_request",
  "unrelated_user_cannot_manage_relationship",
  "expired_pairing_code_rejected",
  "revoked_pairing_code_rejected",
  "sixth_concurrent_acceptance_rejected",
  "caree_declines_pending_request",
  "caree_pauses_and_resumes",
  "participant_removes_relationship",
  "account_deletion_cascades_sensitive_rows"
]) {
  assert.ok(caseById.has(requiredCase), `missing fixture ${requiredCase}`);
}

const model = createRelationshipModel();
const requestId = "11111111-1111-4111-8111-111111111111";
assert.equal(model.apply(requestId, "create:one", "active"), "active");
assert.equal(model.apply(requestId, "create:one", "active"), "active");
assert.throws(
  () => model.apply(requestId, "create:changed", "active"),
  /48012/
);
assert.equal(model.acceptAtCapacity(4), "active");
assert.throws(() => model.acceptAtCapacity(5), /48012/);

assert.equal(
  packageJson.scripts["test:care-circle-operations"],
  "node scripts/care-circle-operations-contract.mjs && pnpm test:care-circle-four-digit"
);
assert.match(
  packageJson.scripts["test:all-local"],
  /test:care-circle-operations/
);

console.log("Inactive Care Circle operation boundary contracts passed");

function createRelationshipModel() {
  const requests = new Map();
  return {
    apply(requestId, digest, result) {
      const existing = requests.get(requestId);
      if (existing && existing.digest !== digest) throw new Error("48012");
      if (!existing) requests.set(requestId, { digest, result });
      return requests.get(requestId).result;
    },
    acceptAtCapacity(activeCarers) {
      if (activeCarers >= 5) throw new Error("48012");
      return "active";
    }
  };
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `missing function ${functionName}`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  const nextAsyncFunction = source.indexOf("\nasync function ", start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter(
    (position) => position > start
  );
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}
