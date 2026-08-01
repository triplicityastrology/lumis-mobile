import { INACTIVE_CARE_CIRCLE_CLIENT_VERSION } from "../../src/services/inactiveCareCircleClient";
import type { WorkbenchRelationship } from "./CareCircleStagingWorkbench";
import { confirmWorkbenchOutcome } from "./workbenchOutcomeIntegrity";

const relationshipId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const common = { clientVersion: INACTIVE_CARE_CIRCLE_CLIENT_VERSION, replayed: false };

confirm({
  request: { action: "accept_relationship", clientRequestId: requestId, relationshipId },
  result: { ok: true, ...common, code: "CARE_CIRCLE_RELATIONSHIP_ACCEPTED", relationshipId },
  projection: { paused: false, relationships: [relationship("active")] },
}, "active_confirmed");
reject({
  request: { action: "accept_relationship", clientRequestId: requestId, relationshipId },
  result: { ok: true, ...common, code: "CARE_CIRCLE_RELATIONSHIP_ACCEPTED", relationshipId },
  projection: { paused: false, relationships: [relationship("pending_caree_acceptance")] },
}, "sent accept cannot imply active");
reject({
  request: { action: "remove_relationship", clientRequestId: requestId, relationshipId },
  result: { ok: true, ...common, code: "CARE_CIRCLE_RELATIONSHIP_REMOVED", relationshipId },
  projection: { paused: false, relationships: [relationship("active")] },
}, "sent removal cannot imply removed");
reject({
  request: { action: "pause_care", clientRequestId: requestId, pausedUntil: "2099-01-01T00:00:00.000Z" },
  result: { ok: true, ...common, code: "CARE_CIRCLE_PAUSED", pausedUntil: "2099-01-01T00:00:00.000Z" },
  projection: { paused: false, relationships: [] },
}, "sent pause cannot imply paused");

const fiveActive = Array.from({ length: 5 }, (_, index) =>
  relationship("active", `10000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`)
);
const pendingSixth = relationship("pending_caree_acceptance", relationshipId);
const conflict = {
  ok: false as const,
  clientVersion: INACTIVE_CARE_CIRCLE_CLIENT_VERSION,
  code: "CARE_CIRCLE_REQUEST_CONFLICT" as const,
  message: "This Care Circle request cannot be completed.",
  retryable: false,
};
confirm({
  request: { action: "accept_relationship", clientRequestId: requestId, relationshipId },
  result: conflict,
  projection: { paused: false, relationships: [...fiveActive, pendingSixth] },
}, "sixth_rejection_confirmed");
reject({
  request: { action: "accept_relationship", clientRequestId: requestId, relationshipId },
  result: conflict,
  projection: { paused: false, relationships: [pendingSixth] },
}, "generic conflict cannot imply capacity rejection");

console.log("Care Circle workbench outcome-integrity fixtures passed");

function relationship(status: WorkbenchRelationship["status"], id = relationshipId): WorkbenchRelationship {
  return { relationshipId: id, participantRole: "caree", otherDisplayName: "Synthetic participant", status };
}
function confirm(input: Parameters<typeof confirmWorkbenchOutcome>[0], expected: ReturnType<typeof confirmWorkbenchOutcome>["evidenceName"]) {
  const result = confirmWorkbenchOutcome(input);
  if (!result.confirmed || result.evidenceName !== expected) throw new Error(`${expected}: assertion failed`);
}
function reject(input: Parameters<typeof confirmWorkbenchOutcome>[0], label: string) {
  if (confirmWorkbenchOutcome(input).confirmed) throw new Error(`${label}: assertion failed`);
}
