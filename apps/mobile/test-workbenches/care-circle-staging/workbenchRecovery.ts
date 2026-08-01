import type {
  CareCircleClientAction,
  CareCircleClientFailureCode,
} from "../../src/services/inactiveCareCircleClient";

export type WorkbenchRecovery = {
  evidenceName:
    | "auth_check_unavailable"
    | "auth_sign_in_failed"
    | "pairing_code_unavailable"
    | "pending_refresh_unavailable"
    | "staging_function_unavailable"
    | "request_not_completed";
  message: string;
  retryKind:
    | "check_session"
    | "sign_in_again"
    | "reenter_pairing_code"
    | "refresh_relationships"
    | "repeat_safe_action"
    | "none";
};

export function resolveWorkbenchRecovery(input:
  | { kind: "session_check" }
  | { kind: "sign_in" }
  | { kind: "relationship_refresh" }
  | {
      kind: "operation";
      action: CareCircleClientAction;
      failureCode: CareCircleClientFailureCode;
    }
): WorkbenchRecovery {
  if (input.kind === "session_check") {
    return recovery(
      "auth_check_unavailable",
      "The disposable staging session could not be checked. No account state changed.",
      "check_session"
    );
  }
  if (input.kind === "sign_in") {
    return recovery(
      "auth_sign_in_failed",
      "Sign-in was not completed. Check the disposable staging account and try again.",
      "sign_in_again"
    );
  }
  if (input.kind === "relationship_refresh") {
    return recovery(
      "pending_refresh_unavailable",
      "Participant-safe relationships could not be refreshed. The previous state remains shown.",
      "refresh_relationships"
    );
  }
  if (input.failureCode === "CARE_CIRCLE_PAIRING_CODE_INVALID") {
    return recovery(
      "pairing_code_unavailable",
      "This pairing code is invalid, expired, or revoked. Ask the Caree to create or rotate it, then enter the new code.",
      "reenter_pairing_code"
    );
  }
  if (input.failureCode === "CARE_CIRCLE_UNAVAILABLE") {
    return recovery(
      "staging_function_unavailable",
      "The staging Care Circle function is unavailable. No change was confirmed.",
      input.action === "submit_pairing_code"
        ? "reenter_pairing_code"
        : "repeat_safe_action"
    );
  }
  if (input.failureCode === "CARE_CIRCLE_AUTH_REQUIRED") {
    return recovery(
      "auth_check_unavailable",
      "The staging session is no longer available. Check the session before continuing.",
      "check_session"
    );
  }
  return recovery(
    "request_not_completed",
    "Care Circle did not confirm this request. Review the current participant-safe state before trying again.",
    "none"
  );
}

function recovery(
  evidenceName: WorkbenchRecovery["evidenceName"],
  message: string,
  retryKind: WorkbenchRecovery["retryKind"]
): WorkbenchRecovery {
  return { evidenceName, message, retryKind };
}
