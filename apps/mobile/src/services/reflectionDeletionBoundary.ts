export type DeleteReflectionResult =
  | { ok: true; status: "deleted" | "already_deleted" }
  | { ok: false; code: "AUTH_REQUIRED" | "NOT_FOUND" | "TEMPORARILY_UNAVAILABLE" };

export type ReflectionDeletionPort = (input: {
  threadId: string;
  clientRequestId: string;
}) => Promise<{ data: unknown; error: { code?: string } | null }>;

export async function deleteReflectionWithPort(
  port: ReflectionDeletionPort,
  input: { threadId: string; clientRequestId: string }
): Promise<DeleteReflectionResult> {
  if (!isUuid(input.threadId) || !isUuid(input.clientRequestId)) {
    return { ok: false, code: "NOT_FOUND" };
  }
  try {
    const { data, error } = await port(input);
    if (error) {
      return {
        ok: false,
        code: error.code === "P0002" ? "NOT_FOUND" : error.code === "42501" ? "AUTH_REQUIRED" : "TEMPORARILY_UNAVAILABLE"
      };
    }
    const status = typeof data === "string" ? data : null;
    return status === "deleted" || status === "already_deleted"
      ? { ok: true, status }
      : { ok: false, code: "TEMPORARILY_UNAVAILABLE" };
  } catch {
    return { ok: false, code: "TEMPORARILY_UNAVAILABLE" };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
