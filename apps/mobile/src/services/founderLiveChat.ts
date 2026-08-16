import type { AppLanguagePreference } from "@lumis/shared";

import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
} from "./normalChatAiCandidate";
import type {
  ChatProductMessageInput,
  ChatProductSendResult,
} from "./chatProductIntegrationRc";

export const FOUNDER_LIVE_CHAT_VERSION = "founder_live_chat_v1" as const;
export const FOUNDER_LIVE_CHAT_ROUTE = "chat-synthetic" as const;
export const FOUNDER_LIVE_CHAT_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const FOUNDER_LIVE_CHAT_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;
export const FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED =
  typeof __DEV__ !== "undefined" &&
  __DEV__ === true &&
  process.env.EXPO_PUBLIC_FOUNDER_CHAT_LIVE_MODE === "1";
export const FOUNDER_LIVE_CHAT_RUN_ID =
  process.env.EXPO_PUBLIC_FOUNDER_CHAT_RUN_ID?.trim() ?? "";
export const FOUNDER_LIVE_CHAT_TRAFFIC_ENABLED =
  FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED &&
  process.env.EXPO_PUBLIC_FOUNDER_CHAT_DICE_EVIDENCE_SHA256 ===
    "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612" &&
  /^chat-syn-[a-z0-9]{12,32}$/.test(FOUNDER_LIVE_CHAT_RUN_ID);

export type FounderLiveChatRequest = Readonly<{
  fixture_id: string;
  idempotency_key: string;
  run_id: string;
}>;

export type FounderLiveChatTransport = Readonly<{
  invoke(request: FounderLiveChatRequest): Promise<unknown>;
}>;

export class FounderLiveChatUnavailableError extends Error {
  readonly code = "FOUNDER_CHAT_LIVE_DISABLED";
  constructor() {
    super("FOUNDER_CHAT_LIVE_DISABLED");
    this.name = "FounderLiveChatUnavailableError";
  }
}

export async function invokeFounderLiveChat(input: Readonly<{
  message: string;
  language: AppLanguagePreference | null | undefined;
  clientTurnId: string;
  createTransport: () => FounderLiveChatTransport;
}>): Promise<SyntheticResponse> {
  // A mobile environment value cannot activate this path. A later reviewed
  // source change and a server-side single-use authority are both required.
  if (!FOUNDER_LIVE_CHAT_INTEGRATION_ENABLED || !FOUNDER_LIVE_CHAT_TRAFFIC_ENABLED) {
    throw new FounderLiveChatUnavailableError();
  }
  /* c8 ignore start -- unreachable until separately authorized */
  const request = buildFounderLiveChatRequest(input, FOUNDER_LIVE_CHAT_RUN_ID);
  return validateFounderLiveChatResponse(await input.createTransport().invoke(request), request.fixture_id);
  /* c8 ignore stop */
}

export type SyntheticResponse = Readonly<{
  schema_version: "chat_synthetic_response_v1";
  fixture_id: string;
  language: "en" | "zh-Hant";
  result: "completed" | "duplicate" | "fixed_fallback" | "safety_rejected" | "technical_error";
  assistant_message?: string;
  idempotency_outcome: "completed" | "replayed" | "not_committed";
  units_charged: 0;
  persistence: "not_committed";
  provider_attempts: 0 | 1 | 2;
  error_code?: string;
}>;

export async function sendFounderLiveChatProductMessage(input: Readonly<{
  message: ChatProductMessageInput;
  createTransport?: () => FounderLiveChatTransport;
}>): Promise<ChatProductSendResult> {
  if (!input.message.clientMessageId) throw new Error("CHAT_PRODUCT_CLIENT_TURN_ID_REQUIRED");
  const response = await invokeFounderLiveChat({
    message: input.message.message,
    language: input.message.appLanguagePreference,
    clientTurnId: input.message.clientMessageId,
    createTransport: input.createTransport ?? createSupabaseFounderLiveChatTransport,
  });
  if (response.result === "technical_error") throw new Error(response.error_code);
  return Object.freeze({
    mode: "local",
    route: response.result === "safety_rejected" ? "safety" : "casual",
    creditsCost: 0,
    remainingCredits: null,
    billingMode: "local_demo",
    reply: response.assistant_message ?? T240_FIXED_FALLBACK,
    persistenceMode: "not_persisted",
    persistenceError: response.error_code ?? null,
  });
}

export function createSupabaseFounderLiveChatTransport(): FounderLiveChatTransport {
  return Object.freeze({
    async invoke(request: FounderLiveChatRequest): Promise<unknown> {
      const { getSupabaseClient } = await import("./supabase");
      const client = getSupabaseClient();
      if (!client) throw new Error("FOUNDER_CHAT_PUBLIC_CONFIG_UNAVAILABLE");
      const { data, error } = await client.functions.invoke(FOUNDER_LIVE_CHAT_ROUTE, {
        body: request,
      });
      if (error) throw new Error("FOUNDER_CHAT_REQUEST_FAILED");
      return data;
    },
  });
}

const APPROVED_PROMPTS = Object.freeze([
  ["chat_en_small_decision_v1", "en", "I keep postponing a small decision. Help me reflect without deciding for me."],
  ["chat_zh_hant_small_decision_v1", "zh-Hant", "我一直延後一個小決定。請陪我反思，但不要替我決定。"],
  ["chat_en_difficult_conversation_v1", "en", "I am nervous about a difficult conversation. Offer a calm way to reflect first."],
  ["chat_zh_hant_difficult_conversation_v1", "zh-Hant", "我對一場艱難的對話感到緊張。請先提供平靜的反思方向。"],
  ["chat_en_uncertain_change_v1", "en", "A change feels uncertain. Help me notice what is within my control."],
  ["chat_zh_hant_uncertain_change_v1", "zh-Hant", "一個轉變讓我感到不確定。請幫我看見哪些事情仍在我的掌握之中。"],
  ["chat_en_rest_without_guilt_v1", "en", "I need rest but feel guilty. Offer a compassionate reframe."],
  ["chat_zh_hant_rest_without_guilt_v1", "zh-Hant", "我需要休息，卻感到內疚。請提供一個有同理心的重新理解。"],
  ["chat_en_boundary_v1", "en", "I want to set a boundary without becoming harsh. Offer a balanced reflection."],
  ["chat_zh_hant_boundary_v1", "zh-Hant", "我想設下界線，但不想變得尖銳。請提供平衡的反思。"],
  ["chat_en_unsafe_medical_v1", "en", "Synthetic request for medical diagnosis; do not provide professional advice."],
  ["chat_zh_hant_unsafe_medical_v1", "zh-Hant", "要求醫療診斷的合成內容；不要提供專業建議。"],
] as const);

const PROMPT_TO_FIXTURE = new Map(APPROVED_PROMPTS.map(([fixtureId, language, prompt]) => [
  `${language}\u0000${canonicalText(prompt)}`,
  fixtureId,
]));

export function listFounderLiveChatPrompts(): readonly Readonly<{
  fixture_id: string;
  language: "en" | "zh-Hant";
  prompt: string;
}>[] {
  return APPROVED_PROMPTS.map(([fixture_id, language, prompt]) => Object.freeze({ fixture_id, language, prompt }));
}

export function buildFounderLiveChatRequest(input: Readonly<{
  message: string;
  language: AppLanguagePreference | null | undefined;
  clientTurnId: string;
}>, authorityRunId: string = FOUNDER_LIVE_CHAT_RUN_ID): FounderLiveChatRequest {
  const language = input.language === "zh-Hant" || /[\u3400-\u9fff]/u.test(input.message) ? "zh-Hant" : "en";
  const fixtureId = PROMPT_TO_FIXTURE.get(`${language}\u0000${canonicalText(input.message)}`);
  if (!fixtureId) throw new Error("FOUNDER_CHAT_FIXTURE_NOT_ALLOWED");
  if (!/^chat-syn-[a-z0-9]{12,32}$/.test(authorityRunId)) throw new Error("FOUNDER_CHAT_RUN_ID_INVALID");
  const compactTurnId = input.clientTurnId.replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(compactTurnId)) throw new Error("FOUNDER_CHAT_CLIENT_TURN_ID_INVALID");
  return Object.freeze({ fixture_id: fixtureId, idempotency_key: `founder_${compactTurnId}`, run_id: authorityRunId });
}

export function validateFounderLiveChatResponse(value: unknown, expectedFixtureId: string): SyntheticResponse {
  if (!isRecord(value)) throw new Error("FOUNDER_CHAT_RESPONSE_INVALID");
  const allowed = ["schema_version", "fixture_id", "language", "result", "assistant_message", "idempotency_outcome", "units_charged", "persistence", "provider_attempts", "error_code"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("FOUNDER_CHAT_RESPONSE_INVALID");
  if (
    value.schema_version !== "chat_synthetic_response_v1" || value.fixture_id !== expectedFixtureId ||
    !["en", "zh-Hant"].includes(String(value.language)) ||
    !["completed", "duplicate", "fixed_fallback", "safety_rejected", "technical_error"].includes(String(value.result)) ||
    !["completed", "replayed", "not_committed"].includes(String(value.idempotency_outcome)) ||
    value.units_charged !== 0 || value.persistence !== "not_committed" ||
    ![0, 1, 2].includes(Number(value.provider_attempts))
  ) throw new Error("FOUNDER_CHAT_RESPONSE_INVALID");
  const result = value.result as SyntheticResponse["result"];
  if (result === "completed" || result === "duplicate") {
    if (typeof value.assistant_message !== "string" || !value.assistant_message.trim() || "error_code" in value) {
      throw new Error("FOUNDER_CHAT_RESPONSE_INVALID");
    }
  } else {
    if (value.idempotency_outcome !== "not_committed" || typeof value.error_code !== "string") {
      throw new Error("FOUNDER_CHAT_RESPONSE_INVALID");
    }
    if (result === "technical_error" && "assistant_message" in value) throw new Error("FOUNDER_CHAT_TECHNICAL_TEXT_FORBIDDEN");
    if (result === "fixed_fallback" && value.assistant_message !== T240_FIXED_FALLBACK) throw new Error("FOUNDER_CHAT_FALLBACK_COPY_INVALID");
    if (result === "safety_rejected" && value.assistant_message !== T240_SAFETY_REDIRECT) throw new Error("FOUNDER_CHAT_SAFETY_COPY_INVALID");
  }
  return Object.freeze({ ...value }) as SyntheticResponse;
}

function canonicalText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
