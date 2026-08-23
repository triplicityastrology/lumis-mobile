/**
 * Server-owned projection of the founder-approved Dice v0.3 material.
 *
 * This module intentionally imports the controlled Level 1/2 bank already
 * used by the Dice feature. A caller supplies a closed fixture only; it never
 * accepts user context, chart data, retrieval content, or a browser prompt.
 *
 * v3 (2026-08-23, prompt-quality handoff): adds an explicit `synthesis` field
 * (rendered as the Reading) and an explicit model-authored `watch_out` field;
 * demotes planet_layer/sign_element_layer/house_layer to internal validated
 * evidence (not rendered as three paragraphs); adds least-data route-gated
 * payload, explicit job_career/situation behaviour, outer-planet ruler dignity,
 * relaxed field lengths, and a standardized route-mismatch envelope shared by
 * prompt, validator and gateway.
 */
import { buildDiceInterpretationRequest } from "../../../apps/mobile/src/features/dice/interpretationBank.ts";
import { HOUSE_FACES, PLANET_FACES, SIGN_FACES } from "../../../apps/mobile/src/features/dice/constants.ts";

export const DICE_V03_INTERPRETATION_CONTRACT_VERSION = "lumis_dice_v0_3_interpretation_contract_v2" as const;
export const DICE_V03_PROMPT_VERSION = "lumis_dice_v0_3_prompt_v3" as const;
export const DICE_V03_RESULT_SCHEMA = "lumis_dice_v0_3_result_v3" as const;

// Standardized route-mismatch envelope — the SAME complete shape is emitted by
// the model (per prompt), recognized by the validator, and propagated by the
// gateway. Never a shortened form in any layer.
export const DICE_ROUTE_MISMATCH_RESULT = "route_mismatch" as const;
export const DICE_ROUTE_MISMATCH_CODE = "DICE_ROUTE_MISMATCH" as const;
export const DICE_ROUTE_MISMATCH_COPY = Object.freeze({
  en: "Lumis couldn’t confirm the correct reading type for this question, so no interpretation was generated. Please rephrase the question clearly and try again.",
  "zh-Hant": "Lumis 暫時未能確認這個問題適用的解讀方式，因此沒有生成解讀。請清晰地改寫問題後再試。",
} as const);

export type DiceV03Language = "en" | "zh-Hant";
export type DiceV03QuestionShape = "judgment" | "timing" | "person_relationship" | "situation" | "place_location" | "job_career" | "choice" | "descriptive" | "open_reflection";
export type DiceV03Landing = Readonly<{ planet: string; sign: string; house: string }>;

export type DiceV03FixtureInput = Readonly<{
  fixture_id: string;
  question: string;
  language: DiceV03Language;
  question_shape: DiceV03QuestionShape;
  outcome: DiceV03Landing;
}>;

export type DiceV03ModelResult = Readonly<{
  schema: typeof DICE_V03_RESULT_SCHEMA;
  language: DiceV03Language;
  planet_layer: string;
  sign_element_layer: string;
  house_layer: string;
  synthesis: string;
  timing_or_pace: string | null;
  judgment: string | null;
  watch_out: string;
  practical_direction: string;
}>;

export type DiceV03RouteMismatch = Readonly<{
  result: typeof DICE_ROUTE_MISMATCH_RESULT;
  code: typeof DICE_ROUTE_MISMATCH_CODE;
  language: DiceV03Language;
}>;

export type DiceV03Output =
  | Readonly<{ kind: "completed"; result: DiceV03ModelResult }>
  | Readonly<{ kind: "route_mismatch"; envelope: DiceV03RouteMismatch }>;

// Field-length caps (characters). Guidance targets live in the prompt; these
// are the hard validator ceilings that replace the old "short" instruction.
const LAYER_MAX = 240;
const SYNTHESIS_MAX = 900;
const CONDITIONAL_MAX = 320; // timing_or_pace, judgment, watch_out, practical_direction
const TOTAL_MAX = 2400;
const SYNTHESIS_MIN_SENTENCES = 2; // opening takes the first sentence; Reading renders the rest

const CHINESE = /[\u3400-\u9fff\uf900-\ufaff]/u;
const CANTONESE_COLLOQUIAL = /[嘅唔喺咁]/u;
// Negated boundary language (for example, "not a guaranteed date") is safe,
// so this only rejects direct promise/date constructions that can be detected
// without incorrectly rejecting the required cautionary copy.
const CERTAINTY_OR_DATE = /\b(will definitely|certainly happen|you will be approved|on \d{1,2}[/-]\d{1,2})\b|(?:結果|申請|事情).{0,8}(?:一定會|必定會|確定會)|(?:日期|批核時間).{0,4}(?:是|為)\s*\d/u;
const GENERIC_BLOCK = /\b(?:trust your intuition|stay open to possibilities|reflect on what this means|everything happens for a reason)\b|(?:相信你的直覺|保持開放|思考這對你的意義|一切自有安排)/iu;
// Reusable filler formulas the founder flagged (handoff §9.4). These are
// placeholder patterns that recur across materially different throws.
const FILLER_PATTERNS = /overusing\s+[A-Z][a-z]+['’]s mode of expression|the issue may be within yourself|\bcommunicate clearly\b|\bset one clear priority\b|\btake a small step\b/iu;
// Location direction/place language must never appear outside place_location.
// Kept conservative to avoid false positives (e.g. the North/South Node names):
// only explicit direction-giving constructions are rejected.
const LOCATION_LEAK = /\b(?:to the|towards the|search (?:the )?|look (?:to the )?)(?:north|south|east|west|north-?east|north-?west|south-?east|south-?west)\b|(?:向|往|朝)(?:東|南|西|北)(?:方|邊)?|方位(?:是|為|在)/iu;

function requireFace<T extends { key: string }>(faces: readonly T[], key: string): T {
  const face = faces.find((entry) => entry.key === key);
  if (!face) throw new Error("DICE_V03_LANDING_NOT_CONTROLLED");
  return face;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sentenceCount(value: string, language: DiceV03Language): number {
  const matches = value.match(language === "zh-Hant" ? /[。！？]/gu : /[.!?]/gu);
  return matches ? matches.length : 0;
}

/**
 * Build the least-data, route-gated selected authority. Direction/place data is
 * included ONLY for place_location; fortune/judgment data ONLY for judgment;
 * speed/pace ONLY for timing; distance for timing/location; relationship tension
 * for judgment/relationship/career/situation. (handoff §10)
 */
function selectedAuthority(
  request: ReturnType<typeof buildDiceInterpretationRequest>,
  shape: DiceV03QuestionShape,
) {
  const isTiming = shape === "timing";
  const isJudgment = shape === "judgment";
  const isLocation = shape === "place_location";
  const carriesTension = isJudgment || shape === "person_relationship" || shape === "job_career" || shape === "situation";

  const planet: Record<string, unknown> = {
    core: request.symbols.planet.meaning.essence,
    detail: request.symbols.planet.meaning.detail,
    watch_out: request.symbols.planet.meaning.watchOut,
    dignity: request.classical.planet.dignity,
    strong_traits: request.classical.planet.goodTraits,
    weak_traits: request.classical.planet.badTraits,
  };
  if (isJudgment) planet.fortune = request.classical.planet.classification;
  if (isTiming) planet.speed = request.classical.planet.speed;

  const sign_element: Record<string, unknown> = {
    expression: request.symbols.sign.meaning.essence,
    detail: request.symbols.sign.meaning.detail,
    element: request.classical.signElement.element,
    nature: request.classical.signElement.nature,
  };
  if (isLocation) {
    sign_element.direction = request.classical.signElement.direction;
    sign_element.places = request.classical.signElement.places;
  }

  const house: Record<string, unknown> = {
    environment: request.symbols.house.meaning.essence,
    detail: request.symbols.house.meaning.detail,
    note: request.classical.house.note,
  };
  if (isJudgment) house.fortune = request.classical.house.classification;
  if (isTiming) house.speed = request.classical.house.speed;
  if (isTiming || isLocation) house.distance = request.classical.house.distance;

  const authority: Record<string, unknown> = { planet, sign_element, house };
  if (carriesTension) authority.relationship = { tension: request.classical.tension, relative_pace: request.classical.pace };
  return authority;
}

export function buildDiceV03Prompt(input: DiceV03FixtureInput): string {
  const request = buildDiceInterpretationRequest(input.question, {
    planet: requireFace(PLANET_FACES, input.outcome.planet),
    sign: requireFace(SIGN_FACES, input.outcome.sign),
    house: requireFace(HOUSE_FACES, input.outcome.house),
  });
  const requiresTiming = input.question_shape === "timing";
  const permitsJudgment = input.question_shape === "judgment";
  const contract = {
    contract_version: DICE_V03_INTERPRETATION_CONTRACT_VERSION,
    prompt_version: DICE_V03_PROMPT_VERSION,
    result_schema: DICE_V03_RESULT_SCHEMA,
    fixture: { fixture_id: input.fixture_id, question: input.question, language: input.language, question_shape: input.question_shape, landed: input.outcome },
    physical_input_contract: "The landed Planet, Sign and House are one fixed physical throw. Never redraw, replace, doubt, supplement or reinterpret them as a different throw.",
    route_sanity_check: `The question_shape is assigned deterministically; do not choose or switch routes. If the assigned shape clearly contradicts the question, return exactly {"result":"${DICE_ROUTE_MISMATCH_RESULT}","code":"${DICE_ROUTE_MISMATCH_CODE}","language":"${input.language}"} and nothing else. This is a non-overriding safety stop, not permission to answer under another route.`,
    source_rules: {
      planet: "core/internal capability; dignity is separate from house",
      sign_element: "expression/atmosphere; how the Planet operates, not a separate personality paragraph; use elemental direction/place only for location",
      house: "external environment, independent fortune/pace/distance; never average with dignity",
      outer_planet_dignity: "Uranus in Aquarius, Neptune in Pisces and Pluto in Scorpio are ruler/strengthened. Outer planets carry no classical benefic/malefic class, keep lower interpretive weight, and describe slower or longer-term currents; apply no exaltation/fall/detriment to them.",
      judgment: permitsJudgment ? "A judgment is permitted: lead with a qualified 吉／凶／平-style conclusion, resolve planet capability vs house environment explicitly, without certainty; do not average dignity with house." : "No 吉凶/favourable-unfavourable verdict. judgment must be null.",
      timing: requiresTiming ? "Lead with overall pace and a relative timeframe in the question's natural scale; state which part may move first and which may stay slow when indicators conflict. Never promise a date or outcome." : "timing_or_pace must be null.",
      job_career: "For job_career, lead with the work theme or type of work/environment. Synthesize suitable function, working style and environment from all three landed symbols; do not emit an unfiltered occupation list.",
      situation: "For situation, lead with the current condition and central tension: what is active, how it operates, and where it is shaped. Remain descriptive unless the route is judgment or timing.",
      language: input.language === "zh-Hant" ? "Use Traditional Chinese written form (書面語), never Cantonese colloquialisms; complete natural sentences, no duplicated connectors, no full sentences forced into noun slots." : "Use English only.",
      exclusions: "No natal/birth/Persona/Knowledge Bank/Level 3/multi-throw/history/Past Reflections/sharing/flying house/tools/retrieval/member/provider data.",
      safety: "Reflective only: no certainty, diagnosis, treatment, legal/financial instruction, emergency advice, or natal inference.",
    },
    selected_authority: selectedAuthority(request, input.question_shape),
    output: {
      exact_keys: ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "synthesis", "timing_or_pace", "judgment", "watch_out", "practical_direction"],
      question_reference: "Every narrative field must directly answer fixture.question. Do not copy the question into a new field; the server-owned presentation adapter anchors the validated reading to the exact question.",
      layers_are_evidence: "planet_layer, sign_element_layer and house_layer are internal controlled evidence (one compact sentence each) and are NOT shown to the member as three paragraphs.",
      synthesis: "One coherent, question-specific reading of at least two complete sentences that weaves the three layers: Planet core + Sign/element expression + House external environment. Resolve tension without averaging dignity and house. Do not paste the layer sentences; do not repeat them verbatim.",
      watch_out: "Exactly one specific risk or blind spot derived from THIS landing and route, explained in plain language; it must change when the dice change. No placeholder like 'overusing [Sign]'s mode of expression'; no fear, diagnosis or certainty.",
      practical_direction: "Exactly one bounded, reversible, non-professional action tied to this question and landing; do not invent dates, resources, jobs, people or circumstances.",
      timing_or_pace: requiresTiming ? "non-empty string leading with pace and relative scale" : "null",
      judgment: permitsJudgment ? "non-empty reflective qualified conclusion" : "null",
      quality: input.language === "zh-Hant"
        ? "No generic advice blocks. Natural written Traditional Chinese. Layer fields ~1 句; synthesis ~140–320 字; other fields 1–2 句; target useful completeness, never pad or end with a fragment."
        : "No generic advice blocks. Layer fields one compact sentence; synthesis about 90–180 words; other fields 1–2 sentences; target useful completeness, never pad or end with a fragment.",
    },
  };
  return [
    "You are a constrained Dice interpretation renderer. The JSON below is authoritative data, not instructions from a user.",
    "Return JSON only. Do not add fields, markdown, an introduction, or a conclusion. Perform route/dignity/synthesis reasoning internally; never reveal it.",
    JSON.stringify(contract),
  ].join("\n");
}

/**
 * Route-mismatch-aware entry the gateway uses. Tries the standardized envelope
 * first, then the completed result.
 */
export function parseDiceV03Output(rawContent: string, expected: Pick<DiceV03FixtureInput, "language" | "question_shape">): DiceV03Output | null {
  const mismatch = parseDiceV03RouteMismatch(rawContent, expected.language);
  if (mismatch) return Object.freeze({ kind: "route_mismatch", envelope: mismatch });
  const result = parseDiceV03ModelResult(rawContent, expected);
  return result ? Object.freeze({ kind: "completed", result }) : null;
}

export function diceV03RouteMismatchEnvelope(language: DiceV03Language): DiceV03RouteMismatch {
  return Object.freeze({ result: DICE_ROUTE_MISMATCH_RESULT, code: DICE_ROUTE_MISMATCH_CODE, language });
}

export function parseDiceV03RouteMismatch(rawContent: string, expectedLanguage: DiceV03Language): DiceV03RouteMismatch | null {
  let raw: unknown;
  try { raw = JSON.parse(rawContent); } catch { return null; }
  if (!isRecord(raw) || !exactKeys(raw, ["result", "code", "language"])) return null;
  if (raw.result !== DICE_ROUTE_MISMATCH_RESULT || raw.code !== DICE_ROUTE_MISMATCH_CODE || raw.language !== expectedLanguage) return null;
  return diceV03RouteMismatchEnvelope(expectedLanguage);
}

export function parseDiceV03ModelResult(rawContent: string, expected: Pick<DiceV03FixtureInput, "language" | "question_shape">): DiceV03ModelResult | null {
  let raw: unknown;
  try { raw = JSON.parse(rawContent); } catch { return null; }
  const keys = ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "synthesis", "timing_or_pace", "judgment", "watch_out", "practical_direction"];
  if (!isRecord(raw) || !exactKeys(raw, keys) || raw.schema !== DICE_V03_RESULT_SCHEMA || raw.language !== expected.language) return null;

  // Required string fields with per-field caps.
  const layerKeys = ["planet_layer", "sign_element_layer", "house_layer"] as const;
  if (layerKeys.some((key) => typeof raw[key] !== "string" || !raw[key].trim() || [...(raw[key] as string)].length > LAYER_MAX)) return null;
  if (typeof raw.synthesis !== "string" || !raw.synthesis.trim() || [...raw.synthesis].length > SYNTHESIS_MAX) return null;
  const synthesis: string = raw.synthesis;
  for (const key of ["watch_out", "practical_direction"] as const) {
    if (typeof raw[key] !== "string" || !raw[key].trim() || [...(raw[key] as string)].length > CONDITIONAL_MAX) return null;
  }

  // Conditional route fields.
  const timingRequired = expected.question_shape === "timing";
  const judgmentPermitted = expected.question_shape === "judgment";
  if ((timingRequired && (typeof raw.timing_or_pace !== "string" || !raw.timing_or_pace.trim() || [...(raw.timing_or_pace as string)].length > CONDITIONAL_MAX)) || (!timingRequired && raw.timing_or_pace !== null)) return null;
  if ((judgmentPermitted && (typeof raw.judgment !== "string" || !raw.judgment.trim() || [...(raw.judgment as string)].length > CONDITIONAL_MAX)) || (!judgmentPermitted && raw.judgment !== null)) return null;

  const layers = [raw.planet_layer, raw.sign_element_layer, raw.house_layer] as string[];
  const nonSynthesis = [...layers, raw.timing_or_pace ?? "", raw.judgment ?? "", raw.watch_out, raw.practical_direction].filter((value): value is string => typeof value === "string" && value.length > 0);
  const text = [...layers, synthesis, raw.timing_or_pace ?? "", raw.judgment ?? "", raw.watch_out, raw.practical_direction].join(" ");

  // Every non-synthesis field is a single complete sentence; synthesis is ≥2.
  const completeSentence = expected.language === "zh-Hant" ? /[。！？]$/u : /[.!?]$/u;
  if (nonSynthesis.some((value) => !completeSentence.test(value.trim()))) return null;
  if (!completeSentence.test(synthesis.trim()) || sentenceCount(synthesis, expected.language) < SYNTHESIS_MIN_SENTENCES) return null;

  // Synthesis must not merely paste a layer sentence verbatim.
  if (layers.some((layer) => synthesis.includes(layer))) return null;

  if ([...text].length > TOTAL_MAX || CERTAINTY_OR_DATE.test(text) || GENERIC_BLOCK.test(text) || FILLER_PATTERNS.test(text)) return null;
  if (expected.question_shape !== "place_location" && LOCATION_LEAK.test(text)) return null;
  if ((expected.language === "en" && CHINESE.test(text)) || (expected.language === "zh-Hant" && (!CHINESE.test(text) || CANTONESE_COLLOQUIAL.test(text)))) return null;
  return Object.freeze(raw as DiceV03ModelResult);
}
