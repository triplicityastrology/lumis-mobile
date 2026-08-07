import { strict as assert } from "node:assert";
import { deliverCareCircleLifecycleEvent } from "./care-circle-lifecycle-delivery";
const input = { eventKey: "relationship:pending", eventType: "carer_request_pending" as const, recipientUserId: "10000000-0000-4000-8000-000000000001" };
let inboxWrites = 0; let pushes = 0;
const ports = { writeInbox: async () => (++inboxWrites === 1 ? "created" : "duplicate") as "created" | "duplicate", push: async () => { pushes += 1; return "token_missing" as const; } };
void (async () => {
  assert.deepEqual(await deliverCareCircleLifecycleEvent(input, ports), { ok: true, inbox: "created", push: "disabled" });
  assert.equal(pushes, 0);
  assert.deepEqual(await deliverCareCircleLifecycleEvent(input, ports, { pushEnabled: true }), { ok: true, inbox: "duplicate", push: "token_missing" });
  assert.equal(inboxWrites, 2);
  console.log("Care Circle lifecycle delivery fixtures passed");
})();
