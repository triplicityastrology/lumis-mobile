import {
  T240_FIXED_FALLBACK,
  T240_SAFETY_REDIRECT,
  type CompanionLanguage,
} from "./founderCompanionChatContract";

export const FOUNDER_POLISHED_CHAT_VERSION = "s2_t299_founder_polished_chat_v1" as const;

export type FounderChatScenario = "success" | "safety" | "fallback";
export type FounderChatPhase = "compose" | "thinking" | "response";

export type FounderChatProjection = Readonly<{
  result: "completed" | "fixed_fallback" | "safety_rejected";
  assistant_message: string;
  provider_calls: 0;
  units_charged: 0;
  persistence_writes: 0;
  thread_writes: 0;
  message_writes: 0;
  member_context: false;
}>;

const SUCCESS_COPY: Record<CompanionLanguage, string> = {
  en: "It sounds like part of you wants a clear answer, while another part needs room to understand what this choice would ask of you. Start with the option that leaves you feeling more steady after the first excitement passes.",
  "zh-Hant": "聽起來，你一方面想要一個清晰答案，另一方面亦需要空間理解這個選擇會要求你承擔甚麼。先留意最初的興奮過後，哪一個方向仍然令你感到較踏實。",
};

export function validateFounderChatPrompt(value: string):
  | Readonly<{ ok: true; prompt: string }>
  | Readonly<{ ok: false; message: string }> {
  const prompt = value.replace(/\r\n?/g, "\n").trim();
  if (!prompt) return Object.freeze({ ok: false, message: "Write one question or reflection first." });
  if (prompt.length > 600) return Object.freeze({ ok: false, message: "Keep this reflection under 600 characters." });
  return Object.freeze({ ok: true, prompt });
}

export function projectFounderChatFixture(
  language: CompanionLanguage,
  scenario: FounderChatScenario,
): FounderChatProjection {
  const result = scenario === "success" ? "completed" : scenario === "safety" ? "safety_rejected" : "fixed_fallback";
  const assistant_message = scenario === "success"
    ? SUCCESS_COPY[language]
    : scenario === "safety"
      ? T240_SAFETY_REDIRECT
      : T240_FIXED_FALLBACK;
  return Object.freeze({
    result,
    assistant_message,
    provider_calls: 0,
    units_charged: 0,
    persistence_writes: 0,
    thread_writes: 0,
    message_writes: 0,
    member_context: false,
  });
}

export function founderChatEligibility(): Readonly<{
  live_enabled: false;
  next_action: "WAITING_FOR_ACCEPTED_DICE_TECHNICAL_EVIDENCE_AND_CHAT_AUTHORITY";
}> {
  return Object.freeze({
    live_enabled: false,
    next_action: "WAITING_FOR_ACCEPTED_DICE_TECHNICAL_EVIDENCE_AND_CHAT_AUTHORITY",
  });
}
