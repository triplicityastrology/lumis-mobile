import {
  advanceSinglePhoneJourney,
  createSinglePhoneJourney,
  type WorkbenchAccountRole,
} from "./singlePhoneJourney";
import type { WorkbenchProgressName } from "./workbenchProgress";

let journey = createSinglePhoneJourney();
equal(journey.stage, "caree_create_code", "journey starts with Caree code creation");

for (const [role, evidence, source, expected] of [
  ["caree", "caree_code_ready", "operation_result", "carer_submit_code"],
  ["carer", "carer_pending_no_authority", "safe_projection", "caree_accept"],
  ["caree", "active", "safe_projection", "carer_verify_active"],
  ["carer", "active", "safe_projection", "caree_pause"],
  ["caree", "paused", "safe_projection", "caree_resume"],
  ["caree", "active", "safe_projection", "carer_remove"],
  ["carer", "removed", "safe_projection", "operator_cleanup_required"],
] as Array<[WorkbenchAccountRole, WorkbenchProgressName, "operation_result" | "safe_projection", string]>) {
  journey = advanceSinglePhoneJourney(journey, {
    accountRole: role,
    evidenceName: evidence,
    confirmationSource: source,
  });
  equal(journey.stage, expected, `journey advances to ${expected}`);
}

equal(
  journey.guidance.includes("counts are zero"),
  true,
  "cleanup is not claimed before count-zero evidence"
);

journey = advanceSinglePhoneJourney(journey, {
  accountRole: "carer",
  evidenceName: "relationship_cleanup_complete",
  confirmationSource: "safe_projection",
});
equal(journey.stage, "cleanup_complete", "confirmed cleanup completes the guide");

let declineJourney = advanceSinglePhoneJourney(createSinglePhoneJourney(), {
  accountRole: "caree",
  evidenceName: "caree_code_ready",
  confirmationSource: "operation_result",
});
declineJourney = advanceSinglePhoneJourney(declineJourney, {
  accountRole: "carer",
  evidenceName: "carer_pending_no_authority",
  confirmationSource: "safe_projection",
});
declineJourney = advanceSinglePhoneJourney(declineJourney, {
  accountRole: "caree",
  evidenceName: "relationship_cleanup_complete",
  confirmationSource: "safe_projection",
});
equal(declineJourney.stage, "carer_submit_code", "decline remains truthful and returns to submission");

const unchanged = advanceSinglePhoneJourney(createSinglePhoneJourney(), {
  accountRole: "carer",
  evidenceName: "caree_code_ready",
  confirmationSource: "operation_result",
});
equal(unchanged.stage, "caree_create_code", "wrong identity cannot advance a Caree step");

const unconfirmed = advanceSinglePhoneJourney(createSinglePhoneJourney(), {
  accountRole: "caree",
  evidenceName: "caree_code_ready",
  confirmationSource: "unconfirmed",
});
equal(unconfirmed.stage, "caree_create_code", "unconfirmed display state cannot advance guide");

const staleProjection = advanceSinglePhoneJourney(
  advanceSinglePhoneJourney(createSinglePhoneJourney(), {
    accountRole: "caree",
    evidenceName: "caree_code_ready",
    confirmationSource: "operation_result",
  }),
  {
    accountRole: "carer",
    evidenceName: "carer_pending_no_authority",
    confirmationSource: "unconfirmed",
  }
);
equal(staleProjection.stage, "carer_submit_code", "stale projection cannot claim pending");

console.log("Care Circle single-iPhone journey fixtures passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
