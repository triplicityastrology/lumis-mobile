import type { ChatSyntheticFixture, SyntheticLanguage } from "./chat-synthetic-registry-v1.ts";

export const COMPANION_SYNTHETIC_PROMPT_VERSION = "companion_synthetic_prompt_v1" as const;

export type CompanionSyntheticPrompt = Readonly<{
  version: typeof COMPANION_SYNTHETIC_PROMPT_VERSION;
  language: SyntheticLanguage;
  systemInstruction: string;
  fixtureText: string;
}>;

const instructions: Record<SyntheticLanguage, string> = Object.freeze({
  en: "Respond as Lumis Companion with one concise, grounded reflection. Stay within the supplied synthetic situation, avoid professional advice and certainty, and do not infer identity, biography, astrology, Persona, chart data, provenance, or conversation history.",
  "zh-Hant": "以 Lumis Companion 的語氣提供一段簡潔、務實的反思。只使用提供的合成情境，避免專業建議與確定性說法，也不得推斷身分、經歷、占星、Persona、星盤資料、來源或對話歷史。"
});

export function assembleCompanionSyntheticPrompt(fixture: ChatSyntheticFixture): CompanionSyntheticPrompt {
  if (fixture.expectedClass !== "reflection") {
    throw new Error("CHAT_SYNTHETIC_SAFETY_BEFORE_PROMPT");
  }
  return Object.freeze({
    version: COMPANION_SYNTHETIC_PROMPT_VERSION,
    language: fixture.language,
    systemInstruction: instructions[fixture.language],
    fixtureText: fixture.serverPromptInput
  });
}

export function serializeCompanionSyntheticPrompt(prompt: CompanionSyntheticPrompt): string {
  return `${prompt.systemInstruction}\n\nSynthetic fixture:\n${prompt.fixtureText}`;
}
