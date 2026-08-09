import { FACE_SETS, type DiceSymbols } from "../features/dice/constants";

export type DiceFixtureLanguage = "en" | "zh-Hant";
export type DiceFixtureClassification = "rejected" | "judgment" | "descriptive_reflection" | "safety" | "technical";
export type DiceFixtureScreen = "question" | "interactive" | "result";

export type DiceFixtureState =
  | "invalid"
  | "bundled"
  | "safety_redirect"
  | "disallowed"
  | "interactive"
  | "loading"
  | "completed"
  | "content_filter"
  | "fallback"
  | "malformed"
  | "timeout_unavailable"
  | "retry"
  | "idempotent_replay"
  | "concurrent_duplicate";

export type DiceInterpretationFixture = {
  id: string;
  language: DiceFixtureLanguage;
  state: DiceFixtureState;
  classification: DiceFixtureClassification;
  question: string;
  symbols: DiceSymbols;
  title: string;
  screen: DiceFixtureScreen;
  routeLabel: string;
  boundaryMessage: string | null;
  reading: string | null;
  watchOut: string | null;
  practicalDirection: string | null;
  evidence: Readonly<{ providerCalls: 0; persistenceWrites: 0; unitsConsumed: 0; idempotency: "new" | "replay" | "converged" }>;
};

export const DICE_INACTIVE_FOUNDER_DECISIONS = {
  finalResultLength: "inactive_unresolved",
  personaTreatment: "inactive_unresolved",
  repeatSymbolWording: "inactive_unresolved",
} as const;

export const DICE_EXACT_CAPTURE_FIXTURES = {
  question_validation: "invalid_hi",
  question_classification: "interactive_en",
  judgment_en: "judgment_en",
  descriptive_zh: "descriptive_zh",
  loading_en: "loading",
  safety_redirect: "safety",
  content_filter: "content_filter",
  fallback_zh: "fallback",
  malformed: "malformed",
  authority_unavailable_en: "timeout_unavailable",
  retry: "retry",
  idempotent_replay: "idempotent_replay",
  concurrent_duplicate: "concurrent_duplicate",
} as const;

export type DiceExactCaptureState = keyof typeof DICE_EXACT_CAPTURE_FIXTURES;

const zeroEffects = (idempotency: "new" | "replay" | "converged" = "new") => ({
  providerCalls: 0 as const,
  persistenceWrites: 0 as const,
  unitsConsumed: 0 as const,
  idempotency,
});

const symbol = (planet: number, sign: number, house: number): DiceSymbols => ({
  planet: FACE_SETS.planet[planet],
  sign: FACE_SETS.sign[sign],
  house: FACE_SETS.house[house],
});

const base = {
  boundaryMessage: null,
  evidence: zeroEffects(),
  practicalDirection: null,
  reading: null,
  watchOut: null,
} as const;

export const DICE_INTERPRETATION_FIXTURES: readonly DiceInterpretationFixture[] = [
  { ...base, id: "invalid_hi", language: "en", state: "invalid", classification: "rejected", screen: "question", routeLabel: "Rejected before submission · unclear", question: "hi", symbols: symbol(0, 0, 0), title: "Question validation", boundaryMessage: "Make this one clear question before continuing." },
  { ...base, id: "bundled", language: "en", state: "bundled", classification: "rejected", screen: "question", routeLabel: "Rejected before submission · bundled", question: "Should I move and should I change jobs?", symbols: symbol(0, 0, 0), title: "One question per throw", boundaryMessage: "Ask one clear question for this throw." },
  { ...base, id: "safety", language: "en", state: "safety_redirect", classification: "safety", screen: "question", routeLabel: "Safety route · no throw", question: "I am in immediate danger. What should I do?", symbols: symbol(0, 0, 0), title: "Safety guidance", boundaryMessage: "This needs immediate human support rather than a Dice reading." },
  { ...base, id: "disallowed", language: "en", state: "disallowed", classification: "rejected", screen: "question", routeLabel: "Excluded scope · no throw", question: "Use my birth chart in this Dice reading?", symbols: symbol(0, 0, 0), title: "Outside Dice scope", boundaryMessage: "That request is outside this Dice reading." },
  { ...base, id: "interactive_en", language: "en", state: "interactive", classification: "judgment", screen: "interactive", routeLabel: "Interactive judgment · local stub", question: "Should I take one measured next step?", symbols: symbol(3, 8, 9), title: "Interactive English reading" },
  { ...base, id: "interactive_zh", language: "zh-Hant", state: "interactive", classification: "descriptive_reflection", screen: "interactive", routeLabel: "互動描述式 · 本機固定內容", question: "我應該如何理解這段關係？", symbols: symbol(5, 11, 6), title: "互動繁體中文解讀" },
  { ...base, id: "loading", language: "en", state: "loading", classification: "descriptive_reflection", screen: "result", routeLabel: "Interpretation loading", question: "What should I notice first?", symbols: symbol(2, 5, 2), title: "Preparing interpretation" },
  { ...base, id: "judgment_en", language: "en", state: "completed", classification: "judgment", screen: "result", routeLabel: "Judgment · completed", question: "Should I take the next measured step?", symbols: symbol(3, 8, 9), title: "Judgment reading", reading: "The landed symbols favor a measured, reversible next step rather than a final commitment.", watchOut: "A Dice reading is perspective, not certainty.", practicalDirection: "Choose one action that gives you more information." },
  { ...base, id: "descriptive_zh", language: "zh-Hant", state: "completed", classification: "descriptive_reflection", screen: "result", routeLabel: "描述式 · 已完成", question: "這件事現在呈現甚麼特質？", symbols: symbol(5, 11, 6), title: "描述式解讀", reading: "這組合邀請你先看清眼前的動力，以及這段經驗正在突顯的主題。", watchOut: "骰子提供反思角度，不是確定答案。", practicalDirection: "先留意一個最值得深入觀察的線索。" },
  { ...base, id: "content_filter", language: "en", state: "content_filter", classification: "safety", screen: "result", routeLabel: "Content-filter safety result", question: "What safer perspective is available?", symbols: symbol(4, 4, 4), title: "Reading paused for safety", reading: "The local stub returned a safety result before ordinary interpretation.", watchOut: "No result was saved and no unit was used." },
  { ...base, id: "fallback", language: "zh-Hant", state: "fallback", classification: "technical", screen: "result", routeLabel: "Fixed fallback", question: "我現在可以怎樣看這件事？", symbols: symbol(1, 3, 3), title: "安全後備狀態", reading: "暫時未能提供這次解讀。你的問題和擲骰結果仍然保留在畫面上。" },
  { ...base, id: "malformed", language: "en", state: "malformed", classification: "technical", screen: "result", routeLabel: "Malformed output rejected", question: "What should I notice here?", symbols: symbol(7, 2, 5), title: "Unsafe output rejected", reading: "The reading could not be shown safely. Your question and landed symbols remain on screen." },
  { ...base, id: "timeout_unavailable", language: "en", state: "timeout_unavailable", classification: "technical", screen: "result", routeLabel: "Timeout · unavailable", question: "Can this result be interpreted?", symbols: symbol(11, 7, 11), title: "Interpretation unavailable", reading: "The local stub remained unavailable after the bounded attempt.", watchOut: "No result was saved and no unit was used." },
  { ...base, id: "retry", language: "en", state: "retry", classification: "technical", screen: "result", routeLabel: "One bounded retry · fallback", question: "How should I approach this situation?", symbols: symbol(6, 6, 6), title: "Retry then fallback", reading: "The reading is temporarily unavailable. Your question and landed symbols remain on screen.", watchOut: "No result was persisted and no unit was used.", practicalDirection: "Retry later without changing the landed symbols." },
  { ...base, id: "idempotent_replay", language: "en", state: "idempotent_replay", classification: "judgment", screen: "result", routeLabel: "Idempotent replay", question: "What should I notice first?", symbols: symbol(3, 8, 9), title: "Same completed result", reading: "A repeated local request returns the same accepted result without another execution.", practicalDirection: "Review the same landed symbols without redrawing them.", evidence: zeroEffects("replay") },
  { ...base, id: "concurrent_duplicate", language: "en", state: "concurrent_duplicate", classification: "judgment", screen: "result", routeLabel: "Concurrent duplicate converged", question: "What should I notice first?", symbols: symbol(3, 8, 9), title: "One interpretation outcome", reading: "Two simultaneous local requests converge on one deterministic result.", practicalDirection: "The landed symbols remain unchanged.", evidence: zeroEffects("converged") },
] as const;

export function getDiceFixture(id: string | undefined): DiceInterpretationFixture {
  return DICE_INTERPRETATION_FIXTURES.find((fixture) => fixture.id === id) ?? DICE_INTERPRETATION_FIXTURES[0];
}

export function getDiceExactCaptureFixture(state: string | undefined): DiceInterpretationFixture {
  const fixtureId = state && state in DICE_EXACT_CAPTURE_FIXTURES
    ? DICE_EXACT_CAPTURE_FIXTURES[state as DiceExactCaptureState]
    : DICE_EXACT_CAPTURE_FIXTURES.question_validation;
  return getDiceFixture(fixtureId);
}

export function buildInteractiveDiceFixture(input: { language: DiceFixtureLanguage; question: string; symbols: DiceSymbols }): DiceInterpretationFixture {
  const zh = input.language === "zh-Hant";
  return {
    ...base,
    id: zh ? "interactive_zh_result" : "interactive_en_result",
    language: input.language,
    state: "completed",
    classification: zh ? "descriptive_reflection" : "judgment",
    screen: "result",
    routeLabel: zh ? "互動描述式 · 已完成" : "Interactive judgment · completed",
    question: input.question,
    symbols: input.symbols,
    title: zh ? "本機固定解讀" : "Local deterministic reading",
    reading: zh ? "這組合邀請你留意眼前的互動模式，以及哪一個細節最值得先理解。" : "These landed symbols invite a measured response that can reveal more before you commit.",
    watchOut: zh ? "象徵不是預測，也不會取代你的判斷。" : "Symbolism is reflective perspective, not a prediction.",
    practicalDirection: zh ? "選一個可逆的小行動，再觀察它帶來的訊息。" : "Choose one reversible next step and notice what it clarifies.",
  };
}
