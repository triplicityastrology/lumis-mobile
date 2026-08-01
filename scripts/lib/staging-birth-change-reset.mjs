export const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";

export function validateBirthChangeResetInput({ projectRef, execute, confirmation, userId }) {
  if (projectRef !== STAGING_PROJECT_REF) throw new Error("STOP_S2_T81_WRONG_PROJECT");
  if (!execute) return { mode: "dry_run" };
  if (confirmation !== "RESET_STAGING_BIRTH_CHANGE_COUNT") throw new Error("STOP_S2_T81_EXECUTE_DISABLED");
  if (!isUuid(userId)) throw new Error("STOP_S2_T81_TARGET_INVALID");
  return { mode: "execute" };
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
