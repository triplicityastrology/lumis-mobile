type StartupAuthStatus = {
  isConfigured: boolean;
  user: unknown | null;
};

export const STARTUP_RESTORE_MAX_RETRIES = 3;
export const STARTUP_RESTORE_RETRY_DELAY_MS = 600;

export function shouldRetryStartupAuthStatus(
  status: StartupAuthStatus,
  retryCount: number
): boolean {
  return status.isConfigured && !status.user && retryCount < STARTUP_RESTORE_MAX_RETRIES;
}

export function shouldRetryStartupAccountError(
  error: unknown,
  retryCount: number
): boolean {
  if (retryCount >= STARTUP_RESTORE_MAX_RETRIES) return false;
  return readSafeErrorCode(error) === "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE";
}

export function startupRetryDelay(retryCount: number): number {
  return STARTUP_RESTORE_RETRY_DELAY_MS * (retryCount + 1);
}

function readSafeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}
