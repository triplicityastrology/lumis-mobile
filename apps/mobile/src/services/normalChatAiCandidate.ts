export const NORMAL_CHAT_AI_CANDIDATE_VERSION = "normal_chat_ai_candidate_v1" as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

// Activation requires a later reviewed source change. Environment variables or
// a mobile caller cannot turn either boundary on.
export const NORMAL_CHAT_AI_INTEGRATION_ENABLED = false as const;
export const NORMAL_CHAT_AI_TRAFFIC_ENABLED = false as const;

export const T240_FIXED_FALLBACK =
  "Lumis couldn’t complete that reflection just now. Please try again." as const;
export const T240_SAFETY_REDIRECT =
  "Lumis can’t help with that request, but it can offer a safer, general reflection instead." as const;

export type NormalChatThreadIntent =
  | Readonly<{ mode: "new" }>
  | Readonly<{ mode: "continue"; thread_id: string }>;

export type NormalChatCandidateRequest = Readonly<{
  schema_version: "normal_chat_mobile_request_v1";
  client_turn_id: string;
  message: string;
  thread_intent: NormalChatThreadIntent;
}>;

export type NormalChatCandidateResponse = Readonly<{
  schema_version: "normal_chat_mobile_response_v1";
  request_id: string;
  client_turn_id: string;
  result: "completed" | "duplicate" | "fixed_fallback" | "safety_rejected" | "technical_error";
  thread_id?: string;
  assistant_message?: string;
  error_code?: string;
  persistence: "committed" | "not_committed";
  idempotency_outcome: "committed" | "replayed" | "not_committed";
  units_charged: number;
  atomic_outcome?: Readonly<{
    user_message: "committed" | "replayed";
    assistant_message: "committed" | "replayed";
    unit_ledger: "committed" | "replayed";
    idempotency_outcome: "committed" | "replayed";
  }>;
}>;

export type NormalChatCandidateTransport = Readonly<{
  invoke(request: NormalChatCandidateRequest): Promise<unknown>;
}>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;
const ERROR_CODE = /^NORMAL_CHAT_[A-Z0-9_]+$/;

export class NormalChatAiCandidateUnavailableError extends Error {
  readonly code = "NORMAL_CHAT_AI_CANDIDATE_DISABLED";

  constructor() {
    super("NORMAL_CHAT_AI_CANDIDATE_DISABLED");
    this.name = "NormalChatAiCandidateUnavailableError";
  }
}

export function buildNormalChatCandidateRequest(input: Readonly<{
  clientTurnId: string;
  message: string;
  threadIntent: NormalChatThreadIntent;
}>): NormalChatCandidateRequest {
  if (!UUID_V4.test(input.clientTurnId)) throw new Error("NORMAL_CHAT_CLIENT_TURN_ID_INVALID");
  const message = canonicalizeMessage(input.message);
  if (!message || [...message].length > 2_000) throw new Error("NORMAL_CHAT_MESSAGE_INVALID");
  const threadIntent = validateThreadIntent(input.threadIntent);
  return Object.freeze({
    schema_version: "normal_chat_mobile_request_v1",
    client_turn_id: input.clientTurnId,
    message,
    thread_intent: threadIntent,
  });
}

export async function invokeNormalChatAiCandidate(
  _request: NormalChatCandidateRequest,
  _transportFactory: () => NormalChatCandidateTransport,
): Promise<NormalChatCandidateResponse> {
  // Keep this before transport construction. A future activation must replace
  // both source constants under separate authority and server-side gates still apply.
  if (!NORMAL_CHAT_AI_INTEGRATION_ENABLED || !NORMAL_CHAT_AI_TRAFFIC_ENABLED) {
    throw new NormalChatAiCandidateUnavailableError();
  }
  /* c8 ignore next 3 -- deliberately unreachable until separately authorized */
  const transport = _transportFactory();
  /* c8 ignore next */
  return validateNormalChatCandidateResponse(await transport.invoke(_request));
}

export function validateNormalChatCandidateResponse(value: unknown): NormalChatCandidateResponse {
  if (!isRecord(value)) throw new Error("NORMAL_CHAT_RESPONSE_INVALID");
  exactKeys(value, [
    "schema_version", "request_id", "client_turn_id", "result", "persistence",
    "idempotency_outcome", "units_charged", "thread_id", "assistant_message",
    "error_code", "atomic_outcome",
  ], true);
  if (
    value.schema_version !== "normal_chat_mobile_response_v1" ||
    typeof value.request_id !== "string" || !REQUEST_ID.test(value.request_id) ||
    typeof value.client_turn_id !== "string" || !UUID_V4.test(value.client_turn_id) ||
    !["completed", "duplicate", "fixed_fallback", "safety_rejected", "technical_error"].includes(String(value.result)) ||
    !["committed", "not_committed"].includes(String(value.persistence)) ||
    !["committed", "replayed", "not_committed"].includes(String(value.idempotency_outcome)) ||
    !Number.isInteger(value.units_charged) || Number(value.units_charged) < 0
  ) throw new Error("NORMAL_CHAT_RESPONSE_INVALID");

  const result = value.result as NormalChatCandidateResponse["result"];
  if (result === "completed" || result === "duplicate") {
    const state = result === "completed" ? "committed" : "replayed";
    if (
      typeof value.thread_id !== "string" || !UUID_V4.test(value.thread_id) ||
      typeof value.assistant_message !== "string" || !value.assistant_message.trim() ||
      value.persistence !== "committed" || value.idempotency_outcome !== state ||
      (result === "duplicate" && value.units_charged !== 0) || "error_code" in value ||
      !isRecord(value.atomic_outcome)
    ) throw new Error("NORMAL_CHAT_RESPONSE_EFFECT_INVALID");
    exactKeys(value.atomic_outcome, ["user_message", "assistant_message", "unit_ledger", "idempotency_outcome"]);
    if (Object.values(value.atomic_outcome).some((entry) => entry !== state)) {
      throw new Error("NORMAL_CHAT_RESPONSE_ATOMIC_INVALID");
    }
  } else {
    if (
      "thread_id" in value || "atomic_outcome" in value || value.persistence !== "not_committed" ||
      value.idempotency_outcome !== "not_committed" || value.units_charged !== 0 ||
      typeof value.error_code !== "string" || !ERROR_CODE.test(value.error_code)
    ) throw new Error("NORMAL_CHAT_RESPONSE_ZERO_EFFECT_INVALID");
    if (result === "technical_error" && "assistant_message" in value) {
      throw new Error("NORMAL_CHAT_RESPONSE_TECHNICAL_TEXT_FORBIDDEN");
    }
    if (result === "fixed_fallback" && value.assistant_message !== T240_FIXED_FALLBACK) {
      throw new Error("NORMAL_CHAT_RESPONSE_FALLBACK_COPY_INVALID");
    }
    if (result === "safety_rejected" && value.assistant_message !== T240_SAFETY_REDIRECT) {
      throw new Error("NORMAL_CHAT_RESPONSE_SAFETY_COPY_INVALID");
    }
  }
  return Object.freeze({ ...value }) as NormalChatCandidateResponse;
}

function canonicalizeMessage(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

function validateThreadIntent(value: NormalChatThreadIntent): NormalChatThreadIntent {
  if (!isRecord(value)) throw new Error("NORMAL_CHAT_THREAD_INTENT_INVALID");
  if (value.mode === "new") {
    exactKeys(value, ["mode"]);
    return Object.freeze({ mode: "new" });
  }
  if (value.mode === "continue") {
    exactKeys(value, ["mode", "thread_id"]);
    if (typeof value.thread_id !== "string" || !UUID_V4.test(value.thread_id)) {
      throw new Error("NORMAL_CHAT_THREAD_INTENT_INVALID");
    }
    return Object.freeze({ mode: "continue", thread_id: value.thread_id });
  }
  throw new Error("NORMAL_CHAT_THREAD_INTENT_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], optional = false): void {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key)) || (!optional && keys.length !== allowed.length)) {
    throw new Error("NORMAL_CHAT_CLOSED_SCHEMA_VIOLATION");
  }
}
