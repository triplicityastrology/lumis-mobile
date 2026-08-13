import {
  assertZeroEffectNonSuccess,
} from "./chatProductPathCandidate";
import {
  validateCorrectedDiceEvidence,
  type ChatAfterDiceLanguage,
  type CorrectedDiceEvidenceBinding,
} from "./chatAfterDiceRoot";
import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  validateNormalChatCandidateResponse,
  type NormalChatCandidateResponse,
} from "./normalChatAiCandidate";

export const CHAT_AFTER_DICE_PRODUCT_VERSION = "s2_t336_chat_after_dice_product_candidate_v1" as const;
export const CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED = false as const;
export const CHAT_AFTER_DICE_PRODUCT_TRAFFIC_ENABLED = false as const;
export const NO_NORMAL_CHAT_INTEGRATION_AUTHORITY = "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" as const;
export const NO_PROVIDER_AUTHORITY = "NO_PROVIDER_AUTHORITY" as const;

export type ExplicitReflectPayload = Readonly<{
  action: "reflect_in_chat";
  question: string;
  results: readonly [string, string, string];
  interpretation: string;
}>;

export type ChatAfterDiceProductPhase =
  | "loading"
  | "completed"
  | "fallback"
  | "safety"
  | "technical_error";

export type ChatAfterDiceProductProjection = Readonly<{
  language: ChatAfterDiceLanguage;
  phase: ChatAfterDiceProductPhase;
  result: NormalChatCandidateResponse["result"] | null;
  assistant_message: string | null;
  presentation_message: string;
  provider_calls: 0;
  persistence_writes: 0;
  units_charged: 0;
  member_context: false;
}>;

export type ChatAfterDiceProductControls = Readonly<{
  accepted_final_dice_evidence_sha256: string | null;
  final_dice_binding: CorrectedDiceEvidenceBinding;
}>;

export class ChatAfterDiceProductUnavailableError extends Error {
  readonly code = "CHAT_AFTER_DICE_PRODUCT_DISABLED";
  constructor() {
    super("CHAT_AFTER_DICE_PRODUCT_DISABLED");
    this.name = "ChatAfterDiceProductUnavailableError";
  }
}

export function buildExplicitReflectPayload(value: unknown): ExplicitReflectPayload {
  if (!isRecord(value) || !exactKeys(value, ["action", "question", "results", "interpretation"])) {
    throw new Error("CHAT_AFTER_DICE_REFLECT_PAYLOAD_INVALID");
  }
  if (value.action !== "reflect_in_chat" || !Array.isArray(value.results) || value.results.length !== 3) {
    throw new Error("CHAT_AFTER_DICE_REFLECT_PAYLOAD_EXPLICIT_ACTION_REQUIRED");
  }
  const question = cleanText(value.question, 600);
  const interpretation = cleanText(value.interpretation, 1_500);
  const results = value.results.map((entry) => cleanText(entry, 80));
  return Object.freeze({
    action: "reflect_in_chat",
    question,
    results: Object.freeze([results[0], results[1], results[2]]) as readonly [string, string, string],
    interpretation,
  });
}

export function validateIndependentlyAcceptedFinalDiceEvidence(
  value: unknown,
  independentlyComputedSha256: string,
  controls: ChatAfterDiceProductControls,
): boolean {
  return isSha256(independentlyComputedSha256) &&
    independentlyComputedSha256 === controls.accepted_final_dice_evidence_sha256 &&
    independentlyComputedSha256 === controls.final_dice_binding.accepted_evidence_sha256 &&
    validateCorrectedDiceEvidence(value, controls.final_dice_binding);
}

export function projectChatAfterDiceProductState(
  language: ChatAfterDiceLanguage,
  phase: "loading",
): ChatAfterDiceProductProjection;
export function projectChatAfterDiceProductState(
  language: ChatAfterDiceLanguage,
  phase: Exclude<ChatAfterDiceProductPhase, "loading">,
  rawResponse: unknown,
): ChatAfterDiceProductProjection;
export function projectChatAfterDiceProductState(
  language: ChatAfterDiceLanguage,
  phase: ChatAfterDiceProductPhase,
  rawResponse?: unknown,
): ChatAfterDiceProductProjection {
  if (phase === "loading") return projection(language, phase, null, null, copy(language).loading);
  const response = validateNormalChatCandidateResponse(rawResponse);
  assertZeroEffectNonSuccess(response);
  const expected = phase === "completed"
    ? ["completed", "duplicate"]
    : phase === "fallback"
      ? ["fixed_fallback"]
      : phase === "safety"
        ? ["safety_rejected"]
        : ["technical_error"];
  if (!expected.includes(response.result)) throw new Error("CHAT_AFTER_DICE_PRODUCT_PHASE_MISMATCH");
  const assistantMessage = response.assistant_message ?? null;
  if (phase === "fallback" && assistantMessage !== T240_FIXED_FALLBACK) {
    throw new Error("CHAT_AFTER_DICE_PRODUCT_FALLBACK_MAPPING_INVALID");
  }
  if (phase === "safety" && assistantMessage !== T240_SAFETY_REDIRECT) {
    throw new Error("CHAT_AFTER_DICE_PRODUCT_SAFETY_MAPPING_INVALID");
  }
  const presentationMessage = phase === "technical_error"
    ? copy(language).technical_error
    : assistantMessage ?? "";
  return projection(language, phase, response.result, assistantMessage, presentationMessage);
}

export function createOneCallLatch(): Readonly<{ claim(): void; calls(): number }> {
  let callCount = 0;
  return Object.freeze({
    claim() {
      if (callCount !== 0) throw new Error("CHAT_AFTER_DICE_DUPLICATE_AI_CALL_BLOCKED");
      callCount += 1;
    },
    calls: () => callCount,
  });
}

export async function invokeChatAfterDiceProductCandidate(input: Readonly<{
  language: ChatAfterDiceLanguage;
  controls: ChatAfterDiceProductControls;
  final_dice_evidence: unknown;
  independently_computed_evidence_sha256: string;
  reflect_payload: unknown;
  call_latch: Readonly<{ claim(): void }>;
  create_transport: () => Readonly<{ invoke(payload: ExplicitReflectPayload): Promise<unknown> }>;
}>): Promise<ChatAfterDiceProductProjection> {
  // Source gates precede evidence, payload, latch, transport, auth, member,
  // persistence, charging, provider, and telemetry work.
  if (!CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED || !CHAT_AFTER_DICE_PRODUCT_TRAFFIC_ENABLED) {
    throw new ChatAfterDiceProductUnavailableError();
  }
  /* c8 ignore start -- separate source authority is required */
  if (!validateIndependentlyAcceptedFinalDiceEvidence(
    input.final_dice_evidence,
    input.independently_computed_evidence_sha256,
    input.controls,
  )) throw new ChatAfterDiceProductUnavailableError();
  const payload = buildExplicitReflectPayload(input.reflect_payload);
  input.call_latch.claim();
  const response = validateNormalChatCandidateResponse(await input.create_transport().invoke(payload));
  const phase = response.result === "completed" || response.result === "duplicate"
    ? "completed"
    : response.result === "fixed_fallback"
      ? "fallback"
      : response.result === "safety_rejected"
        ? "safety"
        : "technical_error";
  return projectChatAfterDiceProductState(input.language, phase, response);
  /* c8 ignore stop */
}

function projection(
  language: ChatAfterDiceLanguage,
  phase: ChatAfterDiceProductPhase,
  result: ChatAfterDiceProductProjection["result"],
  assistant_message: string | null,
  presentation_message: string,
): ChatAfterDiceProductProjection {
  return Object.freeze({
    language,
    phase,
    result,
    assistant_message,
    presentation_message,
    provider_calls: 0,
    persistence_writes: 0,
    units_charged: 0,
    member_context: false,
  });
}

function copy(language: ChatAfterDiceLanguage) {
  return language === "en"
    ? { loading: "Reflecting...", technical_error: "Lumis couldn't complete that reflection. Nothing was saved or charged." }
    : { loading: "整理思緒中...", technical_error: "Lumis 未能完成今次整理。內容並無儲存，亦無扣除任何用量。" };
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw new Error("CHAT_AFTER_DICE_REFLECT_PAYLOAD_INVALID");
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!text || [...text].length > maxLength || /[\r\n]/.test(text)) {
    throw new Error("CHAT_AFTER_DICE_REFLECT_PAYLOAD_INVALID");
  }
  return text;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
