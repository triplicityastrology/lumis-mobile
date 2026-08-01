export const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";

export function validateBirthChangeResetInput({ projectRef, execute, countOnly, confirmation }) {
  if (projectRef !== STAGING_PROJECT_REF) throw new Error("STOP_S2_T81_WRONG_PROJECT");
  if (execute && countOnly) throw new Error("STOP_S2_T91_MODE_CONFLICT");
  if (countOnly) return { mode: "count_only" };
  if (!execute) return { mode: "dry_run" };
  if (confirmation !== "RESET_ALL_STAGING_BIRTH_CHANGE_COUNTS") {
    throw new Error("STOP_S2_T81_EXECUTE_DISABLED");
  }
  return { mode: "execute" };
}

export function summarizeBirthChangeCounts(rows) {
  if (!Array.isArray(rows)) throw new Error("STOP_S2_T91_COUNT_RESULT_INVALID");
  const counts = [0, 0, 0, 0];
  for (const row of rows) {
    const value = row?.successful_change_count;
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new Error("STOP_S2_T91_COUNT_RESULT_INVALID");
    }
    counts[value] += 1;
  }
  return {
    accountsTotal: rows.length,
    count0: counts[0],
    count1: counts[1],
    count2: counts[2],
    count3: counts[3],
    accountsWithConsumedChanges: counts[1] + counts[2] + counts[3],
  };
}
