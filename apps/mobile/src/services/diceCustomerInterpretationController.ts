import type { DiceLiveResultState } from "./diceLiveResultAdapter";
import { resolveDiceFounderFixtureByExactText } from "./diceFounderFixtureRegistry";

export const DICE_CUSTOMER_INTERPRETATION_CONTROLLER_VERSION = "dice_customer_interpretation_controller_v1" as const;

export type DiceCustomerFixtureMode =
  | "disabled"
  | "completed"
  | "safety"
  | "fallback"
  | "technical_error";

export type DiceCustomerInterpretationInput = Readonly<{
  request_key: string;
  question: string;
  planet: string;
  sign: string;
  house: string;
}>;

export type DiceCustomerInterpretationEnvelope = Readonly<{
  request_key: string;
  state: DiceLiveResultState;
}>;

const NO_EFFECTS = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 });

export function parseDiceCustomerFixtureMode(value: string | undefined, development = false): DiceCustomerFixtureMode {
  if (development && (value === "completed" || value === "safety" || value === "fallback" || value === "technical_error")) {
    return value;
  }
  return "disabled";
}

export function createDiceCustomerInterpretationController(mode: DiceCustomerFixtureMode) {
  return Object.freeze({
    request: async (
      input: DiceCustomerInterpretationInput,
      onState: (envelope: DiceCustomerInterpretationEnvelope) => void,
    ): Promise<void> => {
      const fixture = resolveDiceFounderFixtureByExactText(input.question);
      if (!fixture) {
        onState({
          request_key: input.request_key,
          state: { kind: "retry", language: "en", code: "DICE_FIXTURE_ID_INVALID", effects: NO_EFFECTS },
        });
        return;
      }

      const language = fixture.language;
      if (mode === "disabled") {
        onState({ request_key: input.request_key, state: { kind: "disabled", code: "DICE_AI_DISABLED", effects: NO_EFFECTS } });
        return;
      }

      onState({ request_key: input.request_key, state: { kind: "loading", language, effects: NO_EFFECTS } });
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (mode === "safety") {
        onState({
          request_key: input.request_key,
          state: {
            kind: "safety",
            language,
            message: language === "zh-Hant"
              ? "Lumis 無法協助呢個要求，但可以提供一個更安全、概括嘅反思。"
              : "Lumis can’t help with that request, but it can offer a safer, general reflection instead.",
            effects: NO_EFFECTS,
          },
        });
        return;
      }

      if (mode === "fallback") {
        onState({
          request_key: input.request_key,
          state: {
            kind: "fallback",
            language,
            message: language === "zh-Hant"
              ? "Lumis 暫時未能完成呢次反思，請再試一次。"
              : "Lumis couldn’t complete that reflection just now. Please try again.",
            effects: NO_EFFECTS,
          },
        });
        return;
      }

      if (mode === "technical_error") {
        onState({ request_key: input.request_key, state: { kind: "retry", language, code: "DICE_PROVIDER_UNAVAILABLE", effects: NO_EFFECTS } });
        return;
      }

      onState({
        request_key: input.request_key,
        state: language === "zh-Hant"
          ? {
              kind: "interpretation",
              language,
              reading: `${input.planet}、${input.sign} 同 ${input.house} 將問題帶返去你而家可以觀察嘅處境。`,
              watch_out: "唔好將一次擲骰當成注定嘅答案。",
              practical_direction: "揀一個細小、可以驗證嘅下一步，再留意事情點樣回應。",
              effects: NO_EFFECTS,
            }
          : {
              kind: "interpretation",
              language,
              reading: `${input.planet}, ${input.sign}, and ${input.house} bring the question back to the situation you can observe now.`,
              watch_out: "Do not treat one throw as a fixed verdict.",
              practical_direction: "Choose one small, testable next step and notice how the situation responds.",
              effects: NO_EFFECTS,
            },
      });
    },
  });
}

export function isCurrentDiceCustomerEnvelope(
  activeRequestKey: string | null,
  envelope: DiceCustomerInterpretationEnvelope,
): boolean {
  return activeRequestKey !== null && envelope.request_key === activeRequestKey;
}
