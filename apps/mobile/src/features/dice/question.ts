export const DICE_QUESTION_REQUIRED = "DICE_QUESTION_REQUIRED";

export type EmptyDiceQuestionState = {
  activeQuestion: null;
  draft: "";
};

export function normalizeDiceQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function beginNewDiceQuestion(): EmptyDiceQuestionState {
  return {
    activeQuestion: null,
    draft: ""
  };
}

export function requireDiceQuestion(value: string): string {
  const normalized = normalizeDiceQuestion(value);

  if (!normalized) {
    throw new Error(DICE_QUESTION_REQUIRED);
  }

  return normalized;
}
