export const BIRTH_CHANGE_LIMIT = 3;

export function resolveBirthChangeQuota(value: unknown): {
  successfulChanges: number;
  remainingChanges: number;
} {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > BIRTH_CHANGE_LIMIT) {
    throw new Error("BIRTH_CHANGE_COUNT_INVALID");
  }
  return {
    successfulChanges: value,
    remainingChanges: BIRTH_CHANGE_LIMIT - value
  };
}
