import { classifyDiceQuestionRequest } from "../../../../packages/shared/src/config/dice-question-boundary";
import type {
  DiceCustomerInterpretationEnvelope,
  DiceCustomerInterpretationInput,
} from "./diceCustomerInterpretationController";
import { projectDiceMobileResult } from "./diceMobileLiveGateway";

export const DICE_FOUNDER_FREE_TEXT_GATEWAY_VERSION = "dice_founder_free_text_gateway_v1" as const;

const NO_EFFECTS = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 });
const PLANETS = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"]);
const SIGNS = new Set(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
const HOUSES = new Set(Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));

export type DiceFounderFreeTextRequest = Readonly<{
  question: string;
  planet_id: string;
  sign_id: string;
  house_id: string;
}>;

export type DiceFounderFreeTextConfig = Readonly<{
  ai_enabled: boolean;
  traffic_authorized: boolean;
  founder_free_text_enabled: boolean;
  authority_sha256: string | null;
  accepted_authority_sha256: string | null;
  create_transport?: () => (request: DiceFounderFreeTextRequest) => Promise<unknown>;
}>;

export function readDiceFounderFreeTextConfig(): DiceFounderFreeTextConfig {
  return Object.freeze({
    ai_enabled: process.env.EXPO_PUBLIC_DICE_AI_ENABLED === "1",
    traffic_authorized: process.env.EXPO_PUBLIC_DICE_TRAFFIC_AUTHORIZED === "1",
    founder_free_text_enabled: process.env.EXPO_PUBLIC_DICE_FOUNDER_FREE_TEXT === "1",
    authority_sha256: process.env.EXPO_PUBLIC_DICE_FOUNDER_FREE_TEXT_AUTHORITY_SHA256 ?? null,
    accepted_authority_sha256: process.env.EXPO_PUBLIC_DICE_ACCEPTED_FOUNDER_FREE_TEXT_AUTHORITY_SHA256 ?? null,
  });
}

export function createDiceFounderFreeTextController(config: DiceFounderFreeTextConfig) {
  return Object.freeze({
    request: async (
      input: DiceCustomerInterpretationInput,
      onState: (envelope: DiceCustomerInterpretationEnvelope) => void,
    ): Promise<void> => {
      const decision = classifyDiceQuestionRequest({ question: input.question });
      const language = decision.accepted ? decision.language : "en";
      if (!decision.accepted || !closedLanding(input)) {
        emit(onState, input.request_key, { kind: "retry", language, code: "DICE_REQUEST_SCHEMA_INVALID", effects: NO_EFFECTS });
        return;
      }
      if (!config.ai_enabled || !config.traffic_authorized || !config.founder_free_text_enabled) {
        emit(onState, input.request_key, { kind: "disabled", code: "DICE_AI_DISABLED", effects: NO_EFFECTS });
        return;
      }
      if (!acceptedAuthority(config.authority_sha256, config.accepted_authority_sha256)) {
        emit(onState, input.request_key, { kind: "disabled", code: "DICE_LIVE_AUTHORITY_REQUIRED", effects: NO_EFFECTS });
        return;
      }

      emit(onState, input.request_key, { kind: "loading", language, effects: NO_EFFECTS });
      const transport = config.create_transport?.();
      if (!transport) {
        emit(onState, input.request_key, retry(language));
        return;
      }
      try {
        emit(onState, input.request_key, projectDiceMobileResult(await transport({
          question: decision.normalized_question,
          planet_id: input.planet_id,
          sign_id: input.sign_id,
          house_id: input.house_id,
        }), language));
      } catch {
        emit(onState, input.request_key, retry(language));
      }
    },
  });
}

export function acceptedAuthority(value: string | null, accepted: string | null): boolean {
  return value !== null && accepted !== null && /^[0-9a-f]{64}$/u.test(value) && value === accepted;
}

function closedLanding(input: DiceCustomerInterpretationInput): boolean {
  return PLANETS.has(input.planet_id) && SIGNS.has(input.sign_id) && HOUSES.has(input.house_id);
}

function emit(
  onState: (envelope: DiceCustomerInterpretationEnvelope) => void,
  requestKey: string,
  state: DiceCustomerInterpretationEnvelope["state"],
): void {
  onState({ request_key: requestKey, state });
}

function retry(language: "en" | "zh-Hant"): DiceCustomerInterpretationEnvelope["state"] {
  return { kind: "retry", language, code: "DICE_GATEWAY_UNAVAILABLE", effects: NO_EFFECTS };
}
