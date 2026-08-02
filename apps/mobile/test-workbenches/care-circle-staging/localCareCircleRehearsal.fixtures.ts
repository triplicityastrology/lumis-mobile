import { createInactiveCareCircleClient } from "../../src/services/inactiveCareCircleClient";
import { createLocalCareCircleRehearsal } from "./localCareCircleRehearsal";

void run().catch(() => {
  process.exitCode = 1;
});

async function run() {
const harness = createLocalCareCircleRehearsal(() => Date.parse("2026-08-02T00:00:00Z"));
const caree = createInactiveCareCircleClient(harness.operationPort("caree"));
const carer = createInactiveCareCircleClient(harness.operationPort("carer"));
const request = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

const code = await caree.execute({ action: "create_pairing_code", clientRequestId: request(1) });
equal(code.ok && code.code, "CARE_CIRCLE_PAIRING_CODE_READY", "Caree creates local code");
if (!code.ok || code.code !== "CARE_CIRCLE_PAIRING_CODE_READY") throw new Error("fixture unavailable");
const pending = await carer.execute({ action: "submit_pairing_code", clientRequestId: request(2), pairingCode: code.pairingCode });
equal(pending.ok && pending.code, "CARE_CIRCLE_PENDING_CAREE_ACCEPTANCE", "submission is pending only");
equal((await harness.relationshipPort("carer").readProjection()).relationships[0]?.status, "pending_caree_acceptance", "pending has no authority");
if (!pending.ok || !("relationshipId" in pending)) throw new Error("fixture unavailable");
equal((await carer.execute({ action: "accept_relationship", clientRequestId: request(3), relationshipId: pending.relationshipId })).ok, false, "Carer cannot accept");
await caree.execute({ action: "accept_relationship", clientRequestId: request(4), relationshipId: pending.relationshipId });
equal((await harness.relationshipPort("carer").readProjection()).relationships[0]?.status, "active", "Caree acceptance activates");
await caree.execute({ action: "pause_care", clientRequestId: request(5), pausedUntil: "2026-08-03T00:00:00Z" });
equal((await harness.relationshipPort("carer").readProjection()).paused, true, "pause projects safely");
await caree.execute({ action: "resume_care", clientRequestId: request(6) });
equal((await harness.relationshipPort("carer").readProjection()).paused, false, "resume projects safely");
await carer.execute({ action: "remove_relationship", clientRequestId: request(7), relationshipId: pending.relationshipId });
equal(harness.snapshot().relationship, "removed_by_carer", "Carer removes self");
equal(harness.cleanup(), true, "cleanup requires removed relationship");
equal(harness.snapshot().relationship, "none", "cleanup clears synthetic state");

console.log("Care Circle local rehearsal fixtures passed");
}

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
