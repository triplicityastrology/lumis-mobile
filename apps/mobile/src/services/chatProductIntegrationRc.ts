import type { AppLanguagePreference, ChartV2, ChatRoute, PersonaStyleKey } from "@lumis/shared";
import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  buildNormalChatCandidateRequest,
  validateNormalChatCandidateResponse,
  type NormalChatCandidateResponse,
} from "./normalChatAiCandidate";

export const CHAT_PRODUCT_INTEGRATION_RC_VERSION = "s2_t341_chat_product_integration_rc_v1" as const;
export const CHAT_PRODUCT_INTEGRATION_ENABLED = false as const;
export const CHAT_PRODUCT_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_AZURE_TRAFFIC_AUTHORITY = "NO_AZURE_TRAFFIC_AUTHORITY" as const;

export type ChatProductFixtureState =
  | "completed"
  | "fallback"
  | "safety"
  | "technical_error";

export type ChatProductIntegrationMode = Readonly<{
  development_local_fixture: boolean;
  fixture_state: ChatProductFixtureState;
}>;

export type ChatProductMessageInput = Readonly<{
  message: string;
  clientMessageId?: string;
  personaStyle: PersonaStyleKey;
  chart: ChartV2 | null;
  appLanguagePreference?: AppLanguagePreference | null;
  forceNewThread?: boolean;
  threadId?: string | null;
}>;

export type ChatProductSendResult = Readonly<{
  mode: "local" | "supabase";
  route: ChatRoute;
  creditsCost: number;
  remainingCredits: number | null;
  billingMode: "local_demo" | "scaffold_no_charge" | "charged";
  reply: string;
  threadId?: string | null;
  persistenceMode?: "supabase_scaffold" | "not_persisted";
  persistenceError?: string | null;
}>;

export type DiceReflectProductPayload = Readonly<{
  action: "reflect_in_chat";
  question: string;
  results: readonly [string, string, string];
  interpretation: string | null;
  chat_draft: string;
}>;

export class ChatProductIntegrationUnavailableError extends Error {
  readonly code = "CHAT_PRODUCT_INTEGRATION_DISABLED";

  constructor() {
    super("CHAT_PRODUCT_INTEGRATION_DISABLED");
    this.name = "ChatProductIntegrationUnavailableError";
  }
}

export function parseChatProductFixtureState(value: unknown): ChatProductFixtureState {
  return value === "fallback" || value === "safety" || value === "technical_error"
    ? value
    : "completed";
}

export function assertChatProductPathAvailable(mode: ChatProductIntegrationMode): void {
  if (mode.development_local_fixture) return;
  if (!CHAT_PRODUCT_INTEGRATION_ENABLED || !CHAT_PRODUCT_TRAFFIC_ENABLED) {
    throw new ChatProductIntegrationUnavailableError();
  }
}

export async function sendChatProductIntegrationMessage(input: Readonly<{
  message: ChatProductMessageInput;
  mode: ChatProductIntegrationMode;
  create_transport?: () => Readonly<{ invoke(request: unknown): Promise<unknown> }>;
}>): Promise<ChatProductSendResult> {
  assertChatProductPathAvailable(input.mode);

  if (input.mode.development_local_fixture) {
    return invokeLocalFixture(input.message, input.mode.fixture_state);
  }

  /* c8 ignore start -- requires later source activation and server authority */
  if (!input.create_transport) throw new ChatProductIntegrationUnavailableError();
  if (!input.message.clientMessageId) throw new Error("CHAT_PRODUCT_CLIENT_TURN_ID_REQUIRED");
  const request = buildNormalChatCandidateRequest({
    clientTurnId: input.message.clientMessageId,
    message: input.message.message,
    threadIntent: input.message.forceNewThread || !input.message.threadId
      ? { mode: "new" }
      : { mode: "continue", thread_id: input.message.threadId },
  });
  const response = validateNormalChatCandidateResponse(await input.create_transport().invoke(request));
  return mapT240Response(response);
  /* c8 ignore stop */
}

export function buildExplicitDiceReflectProductPayload(chatDraft: unknown): DiceReflectProductPayload {
  if (typeof chatDraft !== "string") throw new Error("CHAT_DICE_REFLECT_PAYLOAD_INVALID");
  const draft = canonicalText(chatDraft, 2_400);
  const prefix = "Help me reflect on my astrology dice throw. My question was: “";
  const resultDivider = "” The dice showed ";
  const interpretationDivider = ". The Dice interpretation was: ";
  if (!draft.startsWith(prefix)) throw new Error("CHAT_DICE_REFLECT_EXPLICIT_ACTION_REQUIRED");

  const resultAt = draft.indexOf(resultDivider, prefix.length);
  if (resultAt < 0) throw new Error("CHAT_DICE_REFLECT_PAYLOAD_INVALID");
  const question = canonicalText(draft.slice(prefix.length, resultAt), 600);
  const remainder = draft.slice(resultAt + resultDivider.length);
  const interpretationAt = remainder.indexOf(interpretationDivider);
  const resultText = interpretationAt < 0
    ? remainder.endsWith(".") ? remainder.slice(0, -1) : ""
    : remainder.slice(0, interpretationAt);
  const results = resultText.split(", ");
  if (results.length !== 3) throw new Error("CHAT_DICE_REFLECT_RESULTS_INVALID");
  const interpretation = interpretationAt < 0
    ? null
    : canonicalText(remainder.slice(interpretationAt + interpretationDivider.length), 1_500);

  return Object.freeze({
    action: "reflect_in_chat",
    question,
    results: Object.freeze(results.map((entry) => canonicalText(entry, 80))) as readonly [string, string, string],
    interpretation,
    chat_draft: draft,
  });
}

function invokeLocalFixture(
  input: ChatProductMessageInput,
  state: ChatProductFixtureState,
): Promise<ChatProductSendResult> {
  const clientMessageId = input.clientMessageId;
  if (!clientMessageId) throw new Error("CHAT_PRODUCT_CLIENT_TURN_ID_REQUIRED");
  const existing = localFixtureRequests.get(clientMessageId);
  if (existing) return existing;

  const request = Promise.resolve().then(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    if (state === "technical_error") throw new Error("CHAT_PRODUCT_LOCAL_TECHNICAL_ERROR");
    const language = resolveLanguage(input.appLanguagePreference, input.message);
    const reply = state === "fallback"
      ? T240_FIXED_FALLBACK
      : state === "safety"
        ? T240_SAFETY_REDIRECT
        : language === "zh-Hant"
          ? "你而家最需要釐清的，未必係立即得到答案，而係分辨自己真正重視甚麼。先留意令你最緊張的部分，再問自己：如果不需要證明任何事，你會怎樣選擇下一步？"
          : "The useful starting point is not forcing an immediate answer, but noticing what matters most beneath the question. Name the part creating the most tension, then ask what your next step would be if you did not need to prove anything.";
    return Object.freeze({
      mode: "local",
      route: state === "safety" ? "safety" : "casual",
      creditsCost: 0,
      remainingCredits: null,
      billingMode: "local_demo",
      reply,
      persistenceMode: "not_persisted",
      persistenceError: null,
    }) satisfies ChatProductSendResult;
  });
  localFixtureDispatchCount += 1;
  localFixtureRequests.set(clientMessageId, request);
  return request;
}

function mapT240Response(response: NormalChatCandidateResponse): ChatProductSendResult {
  if (response.result === "technical_error") throw new Error(response.error_code);
  const committed = response.result === "completed" || response.result === "duplicate";
  return {
    mode: committed ? "supabase" : "local",
    route: response.result === "safety_rejected" ? "safety" : "casual",
    creditsCost: response.units_charged,
    remainingCredits: null,
    billingMode: response.units_charged > 0 ? "charged" : committed ? "scaffold_no_charge" : "local_demo",
    reply: response.assistant_message ?? T240_FIXED_FALLBACK,
    threadId: response.thread_id ?? null,
    persistenceMode: response.persistence === "committed" ? "supabase_scaffold" : "not_persisted",
    persistenceError: response.persistence === "committed" ? null : response.error_code ?? null,
  };
}

function resolveLanguage(
  preference: AppLanguagePreference | null | undefined,
  message: string,
): "en" | "zh-Hant" {
  if (preference === "zh-Hant") return "zh-Hant";
  return /[\u3400-\u9fff]/u.test(message) ? "zh-Hant" : "en";
}

function canonicalText(value: string, maxLength: number): string {
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!text || [...text].length > maxLength || /[\r\n]/.test(text)) {
    throw new Error("CHAT_DICE_REFLECT_PAYLOAD_INVALID");
  }
  return text;
}

const localFixtureRequests = new Map<string, Promise<ChatProductSendResult>>();
let localFixtureDispatchCount = 0;

export function resetChatProductLocalFixtureForTests(): void {
  localFixtureRequests.clear();
  localFixtureDispatchCount = 0;
}

export function getChatProductLocalFixtureDispatchCountForTests(): number {
  return localFixtureDispatchCount;
}
