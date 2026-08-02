import { validateFourDigitSeal } from "./care-circle-four-digit-seal.mjs";

export const CONTROLLED_SESSION_STAGES = Object.freeze([
  "rehearsal_0037",
  "apply_and_parity_0037",
  "pairing_secret_provisioned",
  "inactive_function_deployed",
  "function_health_passed",
  "pat_revoked",
  "two_accounts_ready",
  "mobile_handoff_ready",
  "evidence_complete",
  "cleanup_complete",
  "qa_key_revoked",
]);

export function runControlledSessionSimulation({
  failureAt = null,
  interruptionAt = null,
  sealValidator = validateFourDigitSeal,
  adapterFactory = createPassingAdapter,
} = {}) {
  sealValidator();
  const adapter = adapterFactory();
  stopUnless(adapter && typeof adapter.run === "function", "ADAPTER_INVALID");
  stopUnless(failureAt === null || CONTROLLED_SESSION_STAGES.includes(failureAt), "FAILURE_STAGE_INVALID");
  stopUnless(interruptionAt === null || CONTROLLED_SESSION_STAGES.includes(interruptionAt), "INTERRUPTION_STAGE_INVALID");

  const completed = [];
  for (const stage of CONTROLLED_SESSION_STAGES) {
    if (interruptionAt === stage) return stopped("interrupted", stage, completed);
    const outcome = failureAt === stage ? "failed" : adapter.run(stage);
    stopUnless(outcome === "passed" || outcome === "failed", "ADAPTER_OUTCOME_INVALID");
    if (outcome === "failed") return stopped("failed", stage, completed);
    completed.push(stage);
  }

  return {
    status: "complete",
    completed,
    stoppedAt: null,
    recovery: [],
    nextAction: "session_complete",
  };
}

export function resolveControlledSessionResume(completed) {
  prefix(completed);
  const accountsReady = completed.includes("two_accounts_ready");
  const cleanupComplete = completed.includes("cleanup_complete");
  const qaKeyRevoked = completed.includes("qa_key_revoked");
  const patInUse = completed.includes("pairing_secret_provisioned") && !completed.includes("pat_revoked");

  if (accountsReady && !cleanupComplete) {
    return {
      nextAction: "cleanup_disposable_session",
      recovery: ["cleanup_disposable_session", "revoke_qa_key"],
    };
  }
  if (cleanupComplete && !qaKeyRevoked) {
    return { nextAction: "revoke_qa_key", recovery: ["revoke_qa_key"] };
  }
  if (patInUse) {
    return { nextAction: "revoke_pat", recovery: ["revoke_pat"] };
  }
  return {
    nextAction: CONTROLLED_SESSION_STAGES[completed.length] ?? "session_complete",
    recovery: [],
  };
}

function stopped(status, stoppedAt, completed) {
  const resume = resolveControlledSessionResume(completed);
  return { status, stoppedAt, completed, ...resume };
}

function createPassingAdapter() {
  return { run: () => "passed" };
}

function prefix(completed) {
  stopUnless(Array.isArray(completed) && completed.length <= CONTROLLED_SESSION_STAGES.length, "CHECKPOINT_INVALID");
  completed.forEach((stage, index) => stopUnless(stage === CONTROLLED_SESSION_STAGES[index], "CHECKPOINT_ORDER_INVALID"));
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T153_${code}`);
}
