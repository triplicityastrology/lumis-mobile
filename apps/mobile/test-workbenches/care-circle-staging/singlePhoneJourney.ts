import type { WorkbenchProgressName } from "./workbenchProgress";

export type WorkbenchAccountRole = "caree" | "carer";
export type JourneyConfirmationSource =
  | "operation_result"
  | "safe_projection"
  | "unconfirmed";
export type SinglePhoneJourneyStage =
  | "caree_create_code"
  | "carer_submit_code"
  | "caree_accept"
  | "carer_verify_active"
  | "caree_pause"
  | "caree_resume"
  | "carer_remove"
  | "operator_cleanup_required";

export type SinglePhoneJourney = {
  stage: SinglePhoneJourneyStage;
  label: string;
  guidance: string;
  expectedRole: WorkbenchAccountRole | "operator";
  evidenceName: `single_phone_${SinglePhoneJourneyStage}`;
  nextLabel: string;
  requiredConfirmation: Exclude<JourneyConfirmationSource, "unconfirmed">;
};

export function createSinglePhoneJourney(): SinglePhoneJourney {
  return journey(
    "caree_create_code",
    "Step 1 · Caree creates code",
    "Sign in as the disposable Caree and create the reusable ten-minute code.",
    "caree",
    "Next: switch to the disposable Carer and submit the code.",
    "operation_result"
  );
}

export function advanceSinglePhoneJourney(
  current: SinglePhoneJourney,
  input: {
    accountRole: WorkbenchAccountRole;
    evidenceName: WorkbenchProgressName;
    confirmationSource: JourneyConfirmationSource;
  }
): SinglePhoneJourney {
  if (input.confirmationSource !== current.requiredConfirmation) return current;
  if (
    current.stage === "caree_create_code" &&
    input.accountRole === "caree" &&
    input.evidenceName === "caree_code_ready"
  ) {
    return journey(
      "carer_submit_code",
      "Step 2 · Carer submits code",
      "Switch account, sign in as the disposable Carer, submit the code, and confirm pending means no authority.",
      "carer",
      "Next: switch to the Caree and review the pending request.",
      "safe_projection"
    );
  }
  if (
    current.stage === "carer_submit_code" &&
    input.accountRole === "carer" &&
    input.evidenceName === "carer_pending_no_authority"
  ) {
    return journey(
      "caree_accept",
      "Step 3 · Caree accepts",
      "Switch account, sign in as the disposable Caree, refresh requests, and accept the pending Carer.",
      "caree",
      "Next: switch to the Carer and verify Active.",
      "safe_projection"
    );
  }
  if (
    current.stage === "caree_accept" &&
    input.accountRole === "caree" &&
    input.evidenceName === "active"
  ) {
    return journey(
      "carer_verify_active",
      "Step 4 · Carer verifies active",
      "Switch account, sign in as the disposable Carer, and refresh until the participant-safe projection confirms Active.",
      "carer",
      "Next: switch to the Caree and pause Care Circle.",
      "safe_projection"
    );
  }
  if (
    current.stage === "carer_verify_active" &&
    input.accountRole === "carer" &&
    input.evidenceName === "active"
  ) {
    return journey(
      "caree_pause",
      "Step 5 · Caree pauses",
      "Switch account, sign in as the disposable Caree, pause Care Circle, and wait for confirmed Paused state.",
      "caree",
      "Next: remain as Caree and resume Care Circle.",
      "safe_projection"
    );
  }
  if (
    current.stage === "caree_pause" &&
    input.accountRole === "caree" &&
    input.evidenceName === "paused"
  ) {
    return journey(
      "caree_resume",
      "Step 6 · Caree resumes",
      "Remain signed in as the Caree, resume Care Circle, and wait for confirmed Active state.",
      "caree",
      "Next: switch to the Carer and remove the relationship.",
      "safe_projection"
    );
  }
  if (
    current.stage === "caree_resume" &&
    input.accountRole === "caree" &&
    input.evidenceName === "active"
  ) {
    return journey(
      "carer_remove",
      "Step 7 · Carer removes self",
      "Switch account, sign in as the disposable Carer, refresh, and choose Remove myself.",
      "carer",
      "Next: confirm relationship and account cleanup.",
      "safe_projection"
    );
  }
  if (
    current.stage === "carer_remove" &&
    input.accountRole === "carer" &&
    (input.evidenceName === "removed" || input.evidenceName === "relationship_cleanup_complete")
  ) {
    return journey(
      "operator_cleanup_required",
      "Final · Operator cleanup required",
      "Switch account to sign out, then run the approved two-account cleanup. Completion is truthful only after Auth and run-row counts are zero.",
      "operator",
      "Next: retain only the redacted completion checks.",
      "safe_projection"
    );
  }
  return current;
}

function journey(
  stage: SinglePhoneJourneyStage,
  label: string,
  guidance: string,
  expectedRole: WorkbenchAccountRole | "operator",
  nextLabel: string,
  requiredConfirmation: Exclude<JourneyConfirmationSource, "unconfirmed">
): SinglePhoneJourney {
  return {
    stage,
    label,
    guidance,
    expectedRole,
    evidenceName: `single_phone_${stage}`,
    nextLabel,
    requiredConfirmation,
  };
}
