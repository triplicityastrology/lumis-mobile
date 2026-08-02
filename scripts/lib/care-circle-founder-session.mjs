export const CARE_CIRCLE_FOUNDER_SESSION_STAGES = Object.freeze([
  "deployment_verified",
  "deployment_pat_revoked",
  "function_health_passed",
  "two_accounts_ready",
  "mobile_launcher_ready",
  "code_ready",
  "pending_no_authority",
  "accepted_active",
  "paused",
  "resumed",
  "removed",
  "relationship_cleanup_confirmed",
  "accounts_cleanup_confirmed",
  "qa_key_revoked",
]);

const NEXT_OPERATOR = Object.freeze({
  deployment_verified: "care-circle:deploy-inactive",
  deployment_pat_revoked: "care-circle:deploy-inactive",
  function_health_passed: "care-circle:function-health",
  two_accounts_ready: "care-circle:bootstrap-two-account",
  mobile_launcher_ready: "start:care-circle-founder",
  code_ready: "founder_mobile_evidence",
  pending_no_authority: "founder_mobile_evidence",
  accepted_active: "founder_mobile_evidence",
  paused: "founder_mobile_evidence",
  resumed: "founder_mobile_evidence",
  removed: "founder_mobile_evidence",
  relationship_cleanup_confirmed: "founder_mobile_evidence",
  accounts_cleanup_confirmed: "founder-test:cleanup",
  qa_key_revoked: "founder-test:cleanup",
});

export function resolveFounderSessionCheckpoint(completed) {
  if (!Array.isArray(completed)) stop("CHECKPOINT_SHAPE_INVALID");
  if (completed.length > CARE_CIRCLE_FOUNDER_SESSION_STAGES.length) stop("CHECKPOINT_OVERFLOW");
  for (let index = 0; index < completed.length; index += 1) {
    if (completed[index] !== CARE_CIRCLE_FOUNDER_SESSION_STAGES[index]) {
      stop("CHECKPOINT_ORDER_INVALID");
    }
  }
  const next = CARE_CIRCLE_FOUNDER_SESSION_STAGES[completed.length] ?? null;
  const accountsExist = completed.includes("two_accounts_ready") && !completed.includes("accounts_cleanup_confirmed");
  const qaKeyRevocationRequired = completed.includes("two_accounts_ready") && !completed.includes("qa_key_revoked");
  return {
    status: next ? "incomplete" : "complete",
    completedCount: completed.length,
    next,
    nextOperator: next ? NEXT_OPERATOR[next] : null,
    cleanupRequired: accountsExist,
    qaKeyRevocationRequired,
  };
}

function stop(code) {
  throw new Error(`STOP_S2_T109_${code}`);
}
