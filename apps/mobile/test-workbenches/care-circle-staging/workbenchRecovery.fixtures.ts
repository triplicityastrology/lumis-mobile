import { resolveWorkbenchRecovery } from "./workbenchRecovery";

recovery(
  resolveWorkbenchRecovery({ kind: "session_check" }),
  "auth_check_unavailable",
  "check_session"
);
recovery(
  resolveWorkbenchRecovery({ kind: "sign_in" }),
  "auth_sign_in_failed",
  "sign_in_again"
);
recovery(
  resolveWorkbenchRecovery({ kind: "relationship_refresh" }),
  "pending_refresh_unavailable",
  "refresh_relationships"
);

const expired = resolveWorkbenchRecovery({
  kind: "operation",
  action: "submit_pairing_code",
  failureCode: "CARE_CIRCLE_PAIRING_CODE_INVALID",
});
recovery(expired, "pairing_code_unavailable", "reenter_pairing_code");
contains(expired.message, "invalid, expired, or revoked", "pairing-code truth");

const unavailableSubmit = resolveWorkbenchRecovery({
  kind: "operation",
  action: "submit_pairing_code",
  failureCode: "CARE_CIRCLE_UNAVAILABLE",
});
recovery(
  unavailableSubmit,
  "staging_function_unavailable",
  "reenter_pairing_code"
);

const unavailableSafeAction = resolveWorkbenchRecovery({
  kind: "operation",
  action: "create_pairing_code",
  failureCode: "CARE_CIRCLE_UNAVAILABLE",
});
recovery(
  unavailableSafeAction,
  "staging_function_unavailable",
  "repeat_safe_action"
);

for (const result of [expired, unavailableSubmit, unavailableSafeAction]) {
  excludes(result.message, "48004", "backend code is hidden");
  excludes(result.message, "PAIR-", "pairing material is hidden");
  excludes(result.message, "http", "endpoint is hidden");
}

console.log("Care Circle workbench recovery fixtures passed");

function recovery(
  actual: ReturnType<typeof resolveWorkbenchRecovery>,
  evidenceName: typeof actual.evidenceName,
  retryKind: typeof actual.retryKind
) {
  if (actual.evidenceName !== evidenceName || actual.retryKind !== retryKind) {
    throw new Error(`${evidenceName}: assertion failed`);
  }
}

function contains(value: string, expected: string, label: string) {
  if (!value.includes(expected)) throw new Error(`${label}: assertion failed`);
}

function excludes(value: string, prohibited: string, label: string) {
  if (value.includes(prohibited)) throw new Error(`${label}: assertion failed`);
}
