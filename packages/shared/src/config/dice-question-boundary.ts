export const DICE_QUESTION_BOUNDARY_VERSION = "dice-question-v0.3-pre-submit-1" as const;
export const DICE_QUESTION_MAX_LENGTH = 280;

export type DiceLanguage = "en" | "zh-Hant";
export type DiceQuestionShape =
  | "judgment"
  | "timing"
  | "person_relationship"
  | "situation"
  | "place_location"
  | "job_career"
  | "descriptive"
  | "open_reflection";
export type DiceInterpretationRoute = "judgment" | "descriptive_reflection";

export type DiceQuestionStopCode =
  | "DICE_QUESTION_REQUEST_INVALID"
  | "DICE_QUESTION_UNKNOWN_FIELD"
  | "DICE_QUESTION_EMPTY"
  | "DICE_QUESTION_OVERSIZED"
  | "DICE_QUESTION_UNCLEAR"
  | "DICE_QUESTION_BUNDLED"
  | "DICE_CHOICE_REQUIRES_SEPARATE_THROWS"
  | "DICE_QUESTION_SAFETY_ROUTE_REQUIRED"
  | "DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED"
  | "DICE_QUESTION_SCOPE_EXCLUDED";

type NoEffects = Readonly<{ provider_calls: 0; persistence_writes: 0; units_consumed: 0 }>;
const NO_EFFECTS: NoEffects = Object.freeze({ provider_calls: 0, persistence_writes: 0, units_consumed: 0 });

export type DiceQuestionDecision =
  | {
      accepted: true;
      boundary_version: typeof DICE_QUESTION_BOUNDARY_VERSION;
      language: DiceLanguage;
      normalized_question: string;
      route: DiceInterpretationRoute;
      shape: DiceQuestionShape;
      effects: NoEffects;
    }
  | {
      accepted: false;
      boundary_version: typeof DICE_QUESTION_BOUNDARY_VERSION;
      code: DiceQuestionStopCode;
      effects: NoEffects;
    };

export function normalizeDiceQuestionText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim().replace(/\s+/gu, " ");
}

export function detectDiceQuestionLanguage(value: string): DiceLanguage {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(value) ? "zh-Hant" : "en";
}

export function classifyDiceQuestionRequest(input: unknown): DiceQuestionDecision {
  if (!isRecord(input)) return stopped("DICE_QUESTION_REQUEST_INVALID");
  const keys = Object.keys(input);
  if (keys.some((key) => key !== "question")) return stopped("DICE_QUESTION_UNKNOWN_FIELD");
  if (typeof input.question !== "string") return stopped("DICE_QUESTION_REQUEST_INVALID");

  const question = normalizeDiceQuestionText(input.question);
  if (!question) return stopped("DICE_QUESTION_EMPTY");
  if ([...question].length > DICE_QUESTION_MAX_LENGTH) return stopped("DICE_QUESTION_OVERSIZED");

  const lowered = question.toLocaleLowerCase("en-US");
  if (matchesAny(lowered, [
    /\b(suicide|kill myself|self[- ]harm|emergency|immediate danger)\b/u,
    /(自殺|自殘|緊急危險|立即危險)/u
  ])) return stopped("DICE_QUESTION_SAFETY_ROUTE_REQUIRED");
  if (matchesAny(lowered, [
    /\b(diagnos(?:e|is)|treatment|medication|legal advice|lawsuit|invest|stock|financial advice)\b/u,
    /(診斷|治療|藥物|法律意見|訴訟|投資建議|股票)/u
  ])) return stopped("DICE_QUESTION_PROFESSIONAL_ROUTE_REQUIRED");
  if (matchesAny(lowered, [
    /\b(natal|birth chart|body part|level 3|past reflections?|sharing card|share card|multi[- ]throw|element pattern)\b/u,
    /(本命盤|出生星盤|身體部位|過往反思|分享卡|多次擲骰|元素組合)/u
  ])) return stopped("DICE_QUESTION_SCOPE_EXCLUDED");
  if (matchesAny(lowered, [
    /\b(either\b|\bor\b|versus|\bvs\.?\b)/u,
    /(還是|或者|二選一)/u
  ])) return stopped("DICE_CHOICE_REQUIRES_SEPARATE_THROWS");

  const questionMarks = (question.match(/[?？]/gu) ?? []).length;
  if (questionMarks > 1 || /;|；/u.test(question) || /\b(and|also)\s+(should|can|will|is|when|where|who|what|how|why)\b/iu.test(question)) {
    return stopped("DICE_QUESTION_BUNDLED");
  }
  if ([...question].length < 8 || !looksLikeQuestion(lowered)) return stopped("DICE_QUESTION_UNCLEAR");

  const language = detectDiceQuestionLanguage(question);
  const { route, shape } = classifyShape(lowered);
  return {
    accepted: true,
    boundary_version: DICE_QUESTION_BOUNDARY_VERSION,
    effects: NO_EFFECTS,
    language,
    normalized_question: question,
    route,
    shape
  };
}

function classifyShape(question: string): { route: DiceInterpretationRoute; shape: DiceQuestionShape } {
  if (/\b(when|timing|soon|right time)\b/u.test(question) || /(何時|幾時|時機|現在適合)/u.test(question)) {
    return { route: "judgment", shape: "timing" };
  }
  if (/\b(who|relationship|partner|friend|person|between us)\b/u.test(question) || /(誰|關係|伴侶|朋友|對方)/u.test(question)) {
    return { route: "descriptive_reflection", shape: "person_relationship" };
  }
  if (/\b(where|place|location|move to|travel to)\b/u.test(question) || /(哪裡|何處|地方|地點|搬到)/u.test(question)) {
    return { route: "descriptive_reflection", shape: "place_location" };
  }
  if (/\b(job|career|work|role|business)\b/u.test(question) || /(工作|事業|職涯|職位|生意)/u.test(question)) {
    return { route: "descriptive_reflection", shape: "job_career" };
  }
  if (/\b(reflect|understand|learn|notice|consider)\b/u.test(question) || /(反思|理解|學習|留意|思考)/u.test(question)) {
    return { route: "descriptive_reflection", shape: "open_reflection" };
  }
  if (/\b(what|how|why|describe)\b/u.test(question) || /(什麼|如何|為何|怎樣|描述)/u.test(question)) {
    return { route: "descriptive_reflection", shape: "descriptive" };
  }
  if (/\b(should|can|will|is|are|do|does)\b/u.test(question) || /^(是否|可否|應否|我應該|會不會)/u.test(question)) {
    return { route: "judgment", shape: "judgment" };
  }
  return { route: "descriptive_reflection", shape: "situation" };
}

function looksLikeQuestion(question: string): boolean {
  return /[?？]$/u.test(question)
    || /^(should|can|will|is|are|do|does|when|where|who|what|how|why|which)\b/u.test(question)
    || /^(我應該|是否|可否|應否|會不會|何時|幾時|哪裡|何處|誰|什麼|如何|為何|怎樣)/u.test(question);
}

function stopped(code: DiceQuestionStopCode): DiceQuestionDecision {
  return { accepted: false, boundary_version: DICE_QUESTION_BOUNDARY_VERSION, code, effects: NO_EFFECTS };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}
