import {
  classifyDiceQuestionRequest,
  type DiceInterpretationRoute,
  type DiceLanguage,
  type DiceQuestionShape,
  type DiceQuestionStopCode,
} from "../../../../../packages/shared/src/config/dice-question-boundary";

import {
  DICE_FOUNDER_FIXTURE_REGISTRY_SHA256,
  resolveDiceFounderFixture,
  type ApprovedDiceFounderFixtureId,
} from "../../services/diceFounderFixtureRegistry";

export const DICE_PRE_ROLL_VALIDATION_VERSION = "dice_pre_roll_validation_v1" as const;

export type DicePreRollEffects = Readonly<{
  animation_starts: 0;
  random_results_generated: 0;
  ai_clients_constructed: 0;
  transport_calls: 0;
  history_writes: 0;
  session_writes: 0;
  persistence_writes: 0;
  units_charged: 0;
  navigation_actions: 0;
}>;

export const DICE_PRE_ROLL_NO_EFFECTS: DicePreRollEffects = Object.freeze({
  animation_starts: 0,
  random_results_generated: 0,
  ai_clients_constructed: 0,
  transport_calls: 0,
  history_writes: 0,
  session_writes: 0,
  persistence_writes: 0,
  units_charged: 0,
  navigation_actions: 0,
});

export type DiceFounderFixtureBinding = Readonly<{
  fixture_id: ApprovedDiceFounderFixtureId;
  registry_sha256: typeof DICE_FOUNDER_FIXTURE_REGISTRY_SHA256;
}>;

export type DicePreRollStopCode = DiceQuestionStopCode | "DICE_FOUNDER_FIXTURE_MISMATCH";

export type DicePreRollDecision =
  | Readonly<{
      accepted: true;
      version: typeof DICE_PRE_ROLL_VALIDATION_VERSION;
      normalized_question: string;
      language: DiceLanguage;
      route: DiceInterpretationRoute;
      shape: DiceQuestionShape;
      fixture_id?: ApprovedDiceFounderFixtureId;
      effects: DicePreRollEffects;
    }>
  | Readonly<{
      accepted: false;
      version: typeof DICE_PRE_ROLL_VALIDATION_VERSION;
      code: DicePreRollStopCode;
      message: string;
      effects: DicePreRollEffects;
    }>;

export function validateDicePreRollQuestion(
  question: string,
  founderFixture?: DiceFounderFixtureBinding,
): DicePreRollDecision {
  const decision = classifyDiceQuestionRequest({ question });
  if (!decision.accepted) return stopped(decision.code);

  if (founderFixture) {
    const fixture = founderFixture.registry_sha256 === DICE_FOUNDER_FIXTURE_REGISTRY_SHA256
      ? resolveDiceFounderFixture(founderFixture.fixture_id)
      : null;
    if (!fixture || fixture.exact_text !== decision.normalized_question) {
      return stopped("DICE_FOUNDER_FIXTURE_MISMATCH");
    }
  }

  return Object.freeze({
    accepted: true,
    version: DICE_PRE_ROLL_VALIDATION_VERSION,
    normalized_question: decision.normalized_question,
    language: decision.language,
    route: decision.route,
    shape: decision.shape,
    ...(founderFixture ? { fixture_id: founderFixture.fixture_id } : {}),
    effects: DICE_PRE_ROLL_NO_EFFECTS,
  });
}

export function dicePreRollValidationMessage(code: DicePreRollStopCode): string {
  switch (code) {
    case "DICE_QUESTION_EMPTY":
      return "Enter a question to begin your throw.";
    case "DICE_QUESTION_OVERSIZED":
      return "Shorten your question, then try again.";
    case "DICE_QUESTION_BUNDLED":
      return "Ask one question at a time, then try again.";
    case "DICE_CHOICE_REQUIRES_SEPARATE_THROWS":
      return "Ask about one option at a time, using a separate throw for each.";
    case "DICE_QUESTION_SAFETY_ROUTE_REQUIRED":
      return "This needs immediate human support rather than a Dice reading.";
    case "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED":
      return "Dice cannot replace medical, legal, or financial guidance.";
    case "DICE_QUESTION_SCOPE_EXCLUDED":
      return "Ask one reflective question about this situation instead.";
    case "DICE_FOUNDER_FIXTURE_MISMATCH":
      return "Use the selected Founder question exactly as provided.";
    case "DICE_QUESTION_UNCLEAR":
      return "Make this one clear question, then try again.";
    default:
      return "Check your question and try again.";
  }
}

function stopped(code: DicePreRollStopCode): DicePreRollDecision {
  return Object.freeze({
    accepted: false,
    version: DICE_PRE_ROLL_VALIDATION_VERSION,
    code,
    message: dicePreRollValidationMessage(code),
    effects: DICE_PRE_ROLL_NO_EFFECTS,
  });
}
