import { createHash } from "node:crypto";

export const LIVE_SESSION_STAGES = Object.freeze([
  "accounts_ready",
  "mobile_launched",
  "evidence_complete",
  "cleanup_complete",
  "qa_key_revoked",
]);

export const LIVE_SESSION_ACTIONS = Object.freeze({
  rehearsal: "run_0037_rehearsal",
  migration: "apply_0037",
  secret: "provision_pairing_secret",
  deployment: "deploy_inactive_function",
  health: "run_function_health",
  receipt: "seal_deployment_health_receipt",
  bootstrap: "bootstrap_two_accounts",
  mobile: "launch_one_iphone_journey",
  evidence: "complete_redacted_evidence",
  cleanup: "cleanup_disposable_session",
  revoke: "revoke_qa_key",
  complete: "session_complete",
});

const RECEIPT_KEYS = ["schema", "entries", "digest"];

export function resolveLiveSessionAction({ remoteStages, sessionStages, continueSession = false }) {
  prefix(remoteStages, [
    "rehearsal_accepted",
    "migration_0037_recorded",
    "pairing_secret_verified_and_pat_revoked",
    "function_deployed_and_pat_revoked",
    "health_passed",
    "receipt_sealed",
  ], "REMOTE");
  prefix(sessionStages, LIVE_SESSION_STAGES, "SESSION");

  const remoteActions = [
    LIVE_SESSION_ACTIONS.rehearsal,
    LIVE_SESSION_ACTIONS.migration,
    LIVE_SESSION_ACTIONS.secret,
    LIVE_SESSION_ACTIONS.deployment,
    LIVE_SESSION_ACTIONS.health,
    LIVE_SESSION_ACTIONS.receipt,
  ];
  if (remoteStages.length < remoteActions.length) {
    return result(remoteActions[remoteStages.length], false, false);
  }

  const accountsReady = sessionStages.includes("accounts_ready");
  const cleanupComplete = sessionStages.includes("cleanup_complete");
  const qaKeyRevoked = sessionStages.includes("qa_key_revoked");
  if (accountsReady && !cleanupComplete && !continueSession) {
    return result(LIVE_SESSION_ACTIONS.cleanup, true, true);
  }
  if (cleanupComplete && !qaKeyRevoked) {
    return result(LIVE_SESSION_ACTIONS.revoke, false, true);
  }
  const actions = [
    LIVE_SESSION_ACTIONS.bootstrap,
    LIVE_SESSION_ACTIONS.mobile,
    LIVE_SESSION_ACTIONS.evidence,
    LIVE_SESSION_ACTIONS.cleanup,
    LIVE_SESSION_ACTIONS.revoke,
  ];
  return result(actions[sessionStages.length] ?? LIVE_SESSION_ACTIONS.complete, accountsReady && !cleanupComplete, accountsReady && !qaKeyRevoked);
}

export function createSessionReceipt(entries) {
  stopUnless(Array.isArray(entries), "RECEIPT_ENTRIES_INVALID");
  const stages = entries.map(({ stage }) => stage);
  prefix(stages, LIVE_SESSION_STAGES, "SESSION");
  for (const entry of entries) {
    stopUnless(entry && JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(["evidence_sha256", "stage"]), "RECEIPT_ENTRY_FIELDS_INVALID");
    stopUnless(/^[0-9a-f]{64}$/u.test(entry.evidence_sha256), "RECEIPT_EVIDENCE_INVALID");
  }
  const payload = { schema: "s2_t147_care_circle_live_session_v1", entries };
  return { ...payload, digest: digest(payload) };
}

export function validateSessionReceipt(receipt) {
  stopUnless(receipt && typeof receipt === "object" && !Array.isArray(receipt), "RECEIPT_SHAPE_INVALID");
  stopUnless(JSON.stringify(Object.keys(receipt).sort()) === JSON.stringify([...RECEIPT_KEYS].sort()), "RECEIPT_FIELDS_INVALID");
  stopUnless(receipt.schema === "s2_t147_care_circle_live_session_v1", "RECEIPT_SCHEMA_INVALID");
  const rebuilt = createSessionReceipt(receipt.entries);
  stopUnless(receipt.digest === rebuilt.digest, "RECEIPT_DIGEST_INVALID");
  return receipt;
}

function prefix(actual, expected, label) {
  stopUnless(Array.isArray(actual) && actual.length <= expected.length, `${label}_STAGES_INVALID`);
  actual.forEach((stage, index) => stopUnless(stage === expected[index], `${label}_ORDER_INVALID`));
}

function result(nextAction, cleanupRequired, qaKeyRevocationRequired) {
  return { nextAction, cleanupRequired, qaKeyRevocationRequired };
}

function digest(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T147_${code}`);
}
