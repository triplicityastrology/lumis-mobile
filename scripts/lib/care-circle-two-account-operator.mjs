export const TWO_ACCOUNT_PROJECT_REF = "bmqhwofmdgebpcihjlnb";

export function expectedSyntheticEmail(runId, role) {
  validateRunId(runId);
  if (role !== "caree" && role !== "carer") throw new Error("STOP_S2_T75_ROLE_INVALID");
  return `lumis.s2t75.${role}.${runId}@example.com`;
}

export function validateSetupInput(input) {
  validateRunId(input.runId);
  stopUnless(input.projectRef === TWO_ACCOUNT_PROJECT_REF, "WRONG_PROJECT");
  stopUnless(input.careeEmail === expectedSyntheticEmail(input.runId, "caree"), "CAREE_EMAIL_INVALID");
  stopUnless(input.carerEmail === expectedSyntheticEmail(input.runId, "carer"), "CARER_EMAIL_INVALID");
  stopUnless(input.careeEmail !== input.carerEmail, "ACCOUNT_COLLISION");
  stopUnless(isPassword(input.careePassword), "CAREE_PASSWORD_INVALID");
  stopUnless(isPassword(input.carerPassword), "CARER_PASSWORD_INVALID");
  stopUnless(input.careePassword !== input.carerPassword, "PASSWORD_REUSE_FORBIDDEN");
  return { ok: true };
}

export function validateRunId(runId) {
  stopUnless(/^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(runId), "RUN_ID_INVALID");
}

function isPassword(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 128;
}

function stopUnless(condition, code) {
  if (!condition) throw new Error(`STOP_S2_T75_${code}`);
}
