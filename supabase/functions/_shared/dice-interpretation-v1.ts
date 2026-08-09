export const DICE_INTERPRETATION_ENABLED = false as const;
export const DICE_INTERPRETATION_REQUEST_VERSION = "dice_interpretation_request_v1" as const;
export const DICE_INTERPRETATION_ROUTE_VERSION = "dice_interpretation_route_v1" as const;
export const DICE_INTERPRETATION_RESPONSE_VERSION = "dice_interpretation_response_v1" as const;

const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"] as const;
const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] as const;
const HOUSES = ["house_1", "house_2", "house_3", "house_4", "house_5", "house_6", "house_7", "house_8", "house_9", "house_10", "house_11", "house_12"] as const;
const QUESTION_SHAPES = ["judgment", "timing", "person_relationship", "situation", "place_location", "job_career", "choice", "descriptive", "open_reflection"] as const;
const LANGUAGES = ["en", "zh-Hant"] as const;
const SAFETY_DISPOSITIONS = ["ordinary", "professional_direct", "professional_reflective", "distress_check", "crisis_imminent", "route_unavailable"] as const;

type Planet = typeof PLANETS[number];
type Sign = typeof SIGNS[number];
type House = typeof HOUSES[number];
type Language = typeof LANGUAGES[number];
type QuestionShape = typeof QUESTION_SHAPES[number];
type SafetyDisposition = "ordinary" | "professional_direct" | "professional_reflective" | "distress_check" | "crisis_imminent" | "route_unavailable";

export type DiceInterpretationErrorCode =
  | "DICE_INTERPRETATION_DISABLED"
  | "DICE_INTERPRETATION_INVALID_REQUEST"
  | "DICE_INTERPRETATION_QUESTION_REQUIRED"
  | "DICE_INTERPRETATION_QUESTION_TOO_LONG"
  | "DICE_INTERPRETATION_AUTHORITY_UNAVAILABLE"
  | "DICE_INTERPRETATION_FIXED_TEMPLATE_REQUIRED"
  | "DICE_INTERPRETATION_INVALID_RESPONSE";

export type DiceInterpretationRequest = {
  schemaVersion: typeof DICE_INTERPRETATION_REQUEST_VERSION;
  question: string;
  outcome: { planet: Planet; sign: Sign; house: House };
};

export type TrustedDiceRouteContext = {
  questionShape: QuestionShape | null;
  safetyDisposition: SafetyDisposition;
  appLanguage?: Language;
};

export type DiceRouteEnvelope = {
  version: typeof DICE_INTERPRETATION_ROUTE_VERSION;
  route: "dice";
  language: Language;
  questionShape: QuestionShape;
  question: string;
  outcome: { planet: Planet; sign: Sign; house: House };
  contentAuthority: "AC-DICE-06@2026-07-28";
  contextPolicy: "dice_only_no_chart_persona_or_knowledge_bank";
  requiredPreludeTemplateId: "PROFESSIONAL_REFLECTIVE_DISCLAIMER_EN" | "PROFESSIONAL_REFLECTIVE_DISCLAIMER_ZH_HANT" | null;
};

export type DicePrompt = {
  system: string;
  input: DiceRouteEnvelope;
  limits: { maxOutputCharacters: 1800; maxSectionCharacters: 700 };
};

export type DiceInterpretationResponse = {
  version: typeof DICE_INTERPRETATION_RESPONSE_VERSION;
  language: Language;
  reading: string;
  watchOut: string;
  practicalDirection: string;
};

type SafeFailure = { ok: false; code: DiceInterpretationErrorCode; templateId?: string };
type SafeSuccess<T> = { ok: true; value: T };
export type SafeResult<T> = SafeFailure | SafeSuccess<T>;

const REQUEST_KEYS = ["schemaVersion", "question", "outcome"];
const OUTCOME_KEYS = ["planet", "sign", "house"];
const RESPONSE_KEYS = ["version", "language", "reading", "watchOut", "practicalDirection"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function member<T extends readonly string[]>(set: T, value: unknown): value is T[number] {
  return typeof value === "string" && (set as readonly string[]).includes(value);
}

function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateDiceInterpretationRequest(raw: unknown): SafeResult<DiceInterpretationRequest> {
  if (!isRecord(raw) || !hasExactKeys(raw, REQUEST_KEYS) || raw.schemaVersion !== DICE_INTERPRETATION_REQUEST_VERSION || !isRecord(raw.outcome) || !hasExactKeys(raw.outcome, OUTCOME_KEYS)) {
    return { ok: false, code: "DICE_INTERPRETATION_INVALID_REQUEST" };
  }
  if (typeof raw.question !== "string") return { ok: false, code: "DICE_INTERPRETATION_INVALID_REQUEST" };
  const question = normalizeQuestion(raw.question);
  if (!question) return { ok: false, code: "DICE_INTERPRETATION_QUESTION_REQUIRED" };
  if ([...question].length > 500) return { ok: false, code: "DICE_INTERPRETATION_QUESTION_TOO_LONG" };
  if (!member(PLANETS, raw.outcome.planet) || !member(SIGNS, raw.outcome.sign) || !member(HOUSES, raw.outcome.house)) {
    return { ok: false, code: "DICE_INTERPRETATION_INVALID_REQUEST" };
  }
  return { ok: true, value: { schemaVersion: DICE_INTERPRETATION_REQUEST_VERSION, question, outcome: { planet: raw.outcome.planet, sign: raw.outcome.sign, house: raw.outcome.house } } };
}

export function detectDiceLanguage(question: string): Language {
  return /[\u3400-\u9fff\uf900-\ufaff]/u.test(question) ? "zh-Hant" : "en";
}

function fixedTemplateId(disposition: Exclude<SafetyDisposition, "ordinary" | "professional_reflective">, language: Language): string {
  const suffix = language === "zh-Hant" ? "ZH_HANT" : "EN";
  const family = {
    professional_direct: "PROFESSIONAL_BOUNDARY",
    distress_check: "DISTRESS_SAFETY_CHECK",
    crisis_imminent: "CRISIS_IMMINENT",
    route_unavailable: "ROUTE_UNAVAILABLE",
  }[disposition];
  return `${family}_${suffix}`;
}

export function buildDiceRoutingEnvelope(raw: unknown, trusted: TrustedDiceRouteContext): SafeResult<DiceRouteEnvelope> {
  if (!DICE_INTERPRETATION_ENABLED) return { ok: false, code: "DICE_INTERPRETATION_DISABLED" };
  return buildDiceRoutingEnvelopeForTest(raw, trusted);
}

export function buildDiceRoutingEnvelopeForTest(raw: unknown, trusted: TrustedDiceRouteContext): SafeResult<DiceRouteEnvelope> {
  const request = validateDiceInterpretationRequest(raw);
  if (!request.ok) return request;
  if (!member(SAFETY_DISPOSITIONS, trusted.safetyDisposition) || (trusted.appLanguage !== undefined && !member(LANGUAGES, trusted.appLanguage))) {
    return { ok: false, code: "DICE_INTERPRETATION_AUTHORITY_UNAVAILABLE" };
  }
  const language = detectDiceLanguage(request.value.question);
  if (trusted.safetyDisposition !== "ordinary" && trusted.safetyDisposition !== "professional_reflective") {
    return { ok: false, code: "DICE_INTERPRETATION_FIXED_TEMPLATE_REQUIRED", templateId: fixedTemplateId(trusted.safetyDisposition, trusted.appLanguage ?? language) };
  }
  if (!trusted.questionShape || !member(QUESTION_SHAPES, trusted.questionShape)) {
    return { ok: false, code: "DICE_INTERPRETATION_AUTHORITY_UNAVAILABLE" };
  }
  const preludeLanguage = trusted.appLanguage ?? language;
  const requiredPreludeTemplateId = trusted.safetyDisposition === "professional_reflective"
    ? `PROFESSIONAL_REFLECTIVE_DISCLAIMER_${preludeLanguage === "zh-Hant" ? "ZH_HANT" : "EN"}` as const
    : null;
  return { ok: true, value: { version: DICE_INTERPRETATION_ROUTE_VERSION, route: "dice", language, questionShape: trusted.questionShape, question: request.value.question, outcome: request.value.outcome, contentAuthority: "AC-DICE-06@2026-07-28", contextPolicy: "dice_only_no_chart_persona_or_knowledge_bank", requiredPreludeTemplateId } };
}

export function assembleDicePrompt(envelope: DiceRouteEnvelope): DicePrompt {
  return {
    system: [
      "Interpret only the landed Dice outcome supplied by the server.",
      "Use the reviewed Dice content authority; do not calculate or redraw symbols.",
      "Do not use natal chart, birth data, Persona, Knowledge Bank, history, billing, provider or account context.",
      "For judgment questions, resolve planet capability against the external house; for descriptive questions, describe without a favorable/unfavorable verdict.",
      `Write only in ${envelope.language}. Give reflective perspective, never certainty, diagnosis, treatment, legal advice, financial instruction or emergency handling.`,
      "Return exactly reading, watchOut and practicalDirection."
    ].join(" "),
    input: envelope,
    limits: { maxOutputCharacters: 1800, maxSectionCharacters: 700 }
  };
}

export function projectDiceInterpretationResponse(raw: unknown, expectedLanguage: Language): SafeResult<DiceInterpretationResponse> {
  if (!isRecord(raw) || !hasExactKeys(raw, RESPONSE_KEYS) || raw.version !== DICE_INTERPRETATION_RESPONSE_VERSION || raw.language !== expectedLanguage) {
    return { ok: false, code: "DICE_INTERPRETATION_INVALID_RESPONSE" };
  }
  const unknownValues = [raw.reading, raw.watchOut, raw.practicalDirection];
  if (unknownValues.some((value) => typeof value !== "string" || value.trim().length === 0 || [...value].length > 700)) {
    return { ok: false, code: "DICE_INTERPRETATION_INVALID_RESPONSE" };
  }
  const values = unknownValues as string[];
  const total = values.reduce((sum, value) => sum + [...(value as string)].length, 0);
  if (total > 1800) return { ok: false, code: "DICE_INTERPRETATION_INVALID_RESPONSE" };
  const response = raw as unknown as DiceInterpretationResponse;
  const containsChinese = /[\u3400-\u9fff\uf900-\ufaff]/u.test(values.join(""));
  if ((expectedLanguage === "en" && containsChinese) || (expectedLanguage === "zh-Hant" && !containsChinese)) {
    return { ok: false, code: "DICE_INTERPRETATION_INVALID_RESPONSE" };
  }
  return { ok: true, value: { ...response, reading: response.reading.trim(), watchOut: response.watchOut.trim(), practicalDirection: response.practicalDirection.trim() } };
}
