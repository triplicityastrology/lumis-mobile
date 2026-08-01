import type { CareCircleClientInput, CareCircleClientResult } from "../../src/services/inactiveCareCircleClient";
import type { WorkbenchProjection } from "./CareCircleStagingWorkbench";

export type ConfirmedWorkbenchOutcome = {
  confirmed: boolean;
  evidenceName: "pending_confirmed" | "active_confirmed" | "declined_confirmed" | "removed_confirmed" | "paused_confirmed" | "resumed_confirmed" | "sixth_rejection_confirmed" | "outcome_unconfirmed";
  message: string;
};

export function confirmWorkbenchOutcome(input: {
  request: CareCircleClientInput;
  result: CareCircleClientResult;
  projection: WorkbenchProjection;
}): ConfirmedWorkbenchOutcome {
  const requestedId = "relationshipId" in input.request ? input.request.relationshipId : null;
  const resultId = input.result.ok && "relationshipId" in input.result ? input.result.relationshipId : null;
  const relationship = input.projection.relationships.find(
    (item) => item.relationshipId === (requestedId ?? resultId)
  );

  if (!input.result.ok) {
    const activeCount = input.projection.relationships.filter(
      (item) => item.participantRole === "caree" && item.status === "active"
    ).length;
    if (
      input.request.action === "accept_relationship" &&
      input.result.code === "CARE_CIRCLE_REQUEST_CONFLICT" &&
      activeCount === 5 && relationship?.status === "pending_caree_acceptance"
    ) {
      return confirmed("sixth_rejection_confirmed", "Backend capacity rejection confirmed. Five Carers remain active and the sixth remains pending.");
    }
    return unconfirmed();
  }
  if (input.request.action === "submit_pairing_code" && relationship?.status === "pending_caree_acceptance") {
    return confirmed("pending_confirmed", "Pending Caree acceptance confirmed. This Carer has no active authority.");
  }
  if (input.request.action === "accept_relationship" && relationship?.status === "active") {
    return confirmed("active_confirmed", "Caree acceptance and active status confirmed.");
  }
  if (input.request.action === "decline_relationship" && relationship?.status === "declined") {
    return confirmed("declined_confirmed", "Declined status confirmed.");
  }
  if (input.request.action === "remove_relationship" && (relationship?.status === "removed_by_caree" || relationship?.status === "removed_by_carer")) {
    return confirmed("removed_confirmed", "Participant removal confirmed.");
  }
  if (input.request.action === "pause_care" && input.projection.paused) {
    return confirmed("paused_confirmed", "Paused state confirmed.");
  }
  if (input.request.action === "resume_care" && !input.projection.paused) {
    return confirmed("resumed_confirmed", "Resumed state confirmed.");
  }
  return unconfirmed();
}

function confirmed(
  evidenceName: Exclude<ConfirmedWorkbenchOutcome["evidenceName"], "outcome_unconfirmed">,
  message: string
): ConfirmedWorkbenchOutcome {
  return { confirmed: true, evidenceName, message };
}

function unconfirmed(): ConfirmedWorkbenchOutcome {
  return {
    confirmed: false,
    evidenceName: "outcome_unconfirmed",
    message: "The request response was received, but the participant-safe state did not confirm the change.",
  };
}
