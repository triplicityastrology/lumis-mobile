import {
  advanceSinglePhoneJourney,
  createSinglePhoneJourney,
  type WorkbenchAccountRole,
} from "./singlePhoneJourney";
import type { WorkbenchProgressName } from "./workbenchProgress";

let journey = createSinglePhoneJourney();
equal(journey.stage, "caree_create_code", "journey starts with Caree code creation");

for (const [role, evidence, expected] of [
  ["caree", "caree_code_ready", "carer_submit_code"],
  ["carer", "carer_pending_no_authority", "caree_accept"],
  ["caree", "active", "carer_verify_active"],
  ["carer", "active", "caree_pause"],
  ["caree", "paused", "caree_resume"],
  ["caree", "active", "carer_remove"],
  ["carer", "removed", "operator_cleanup_required"],
] as Array<[WorkbenchAccountRole, WorkbenchProgressName, string]>) {
  journey = advanceSinglePhoneJourney(journey, {
    accountRole: role,
    evidenceName: evidence,
  });
  equal(journey.stage, expected, `journey advances to ${expected}`);
}

equal(
  journey.guidance.includes("counts are zero"),
  true,
  "cleanup is not claimed before count-zero evidence"
);

const unchanged = advanceSinglePhoneJourney(createSinglePhoneJourney(), {
  accountRole: "carer",
  evidenceName: "caree_code_ready",
});
equal(unchanged.stage, "caree_create_code", "wrong identity cannot advance a Caree step");

console.log("Care Circle single-iPhone journey fixtures passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
