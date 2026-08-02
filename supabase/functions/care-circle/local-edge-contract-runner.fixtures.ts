import assert from "node:assert/strict";

import { runLocalCareCircleRequest, type LocalEdgePorts } from "./local-edge-contract-runner.ts";

const requestId = "10000000-0000-4000-8000-000000000001";
const relationshipId = "20000000-0000-4000-8000-000000000001";
const codeId = "30000000-0000-4000-8000-000000000001";
const actorId = "40000000-0000-4000-8000-000000000001";
const calls: Array<{ name: string; actor?: unknown }> = [];
let responses: Array<{ data?: unknown; errorCode?: string }> = [];
const ports: LocalEdgePorts = {
  auth: { actorForAuthorization: async (value) => value === "Bearer fixture" ? actorId : null },
  rpc: { call: async (name, params) => { calls.push({ name, actor: params.p_actor_user_id }); return responses.shift() ?? {}; } },
  pairingCodeForCreate: () => "2468",
};

async function run(action: string, extra: Record<string, unknown> = {}) {
  return runLocalCareCircleRequest("Bearer fixture", { action, client_request_id: requestId, ...extra }, ports);
}
function queue(data?: unknown, errorCode?: string) { responses.push({ data, errorCode }); }
function safe(data: Record<string, unknown>) { return { ok: true, idempotent: false, ...data }; }

async function main() {
assert.equal((await runLocalCareCircleRequest(null, {}, ports)).status, 401);
assert.equal((await run("unknown")).status, 409);
assert.equal((await runLocalCareCircleRequest("Bearer fixture", { action: "care_resume", client_request_id: requestId, secret: "forbidden" }, ports)).status, 409);

queue(safe({ status: "active", code_id: codeId, expires_at: "2030-01-01T00:00:00.000Z" }));
const created = await run("pairing_code_create");
assert.deepEqual(created, { status: 200, body: { ok: true, status: "active", idempotent: false, code_id: codeId, expires_at: "2030-01-01T00:00:00.000Z", pairing_code: "2468" } });
assert.deepEqual(calls.at(-1), { name: "create_care_pairing_code_backend", actor: actorId });

queue({ allowed: true }); queue(safe({ status: "pending_caree_acceptance", relationship_id: relationshipId }));
const pending = await run("pairing_code_submit", { pairing_code: "2468" });
assert.equal(pending.status, 200); assert.equal((pending.body as { status?: string }).status, "pending_caree_acceptance");
assert.equal("pairing_code" in pending.body, false);

for (const [action, status] of [["relationship_accept", "active"], ["relationship_decline", "declined"], ["relationship_remove", "removed_by_carer"]] as const) {
  queue(safe({ status, relationship_id: relationshipId }));
  const result = await run(action, { relationship_id: relationshipId });
  assert.equal((result.body as { status?: string }).status, status);
}
queue(safe({ status: "paused", paused_until: "2030-01-01T00:00:00.000Z" }));
assert.equal((await run("care_pause", { paused_until: "2030-01-01T00:00:00.000Z" })).status, 200);
queue(safe({ status: "active" })); assert.equal((await run("care_resume")).status, 200);

queue({ allowed: false });
const throttled = await run("pairing_code_submit", { pairing_code: "2468" });
assert.deepEqual(throttled, { status: 410, body: { error: { code: "48004", message: "This pairing code is not valid or has expired." } } });
queue({ allowed: true }); queue(undefined, "48004");
assert.deepEqual(await run("pairing_code_submit", { pairing_code: "2468" }), throttled);
queue(undefined, "DATABASE_PRIVATE_DETAIL");
const unknown = await run("relationship_accept", { relationship_id: relationshipId });
assert.equal((unknown.body as { error?: { code?: string } }).error?.code, "CARE_CIRCLE_OPERATION_FAILED");

const serialized = JSON.stringify({ created: { ...created, body: { ...created.body, pairing_code: "[transient-create-only]" } }, pending, throttled, unknown });
for (const forbidden of ["2468", "DATABASE_PRIVATE_DETAIL", "pairing-secret", "service-role"]) assert.equal(serialized.includes(forbidden), false);
assert.ok(calls.every(({ actor }) => actor === actorId));
console.log("S2-T149 local Care Circle Edge contract matrix passed.");
}

void main().catch(() => { process.exitCode = 1; });
