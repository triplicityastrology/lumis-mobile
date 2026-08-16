/**
 * Server-owned projection of the founder-approved Dice v0.3 material.
 *
 * This module intentionally imports the controlled Level 1/2 bank already
 * used by the Dice feature. A caller supplies a closed fixture only; it never
 * accepts user context, chart data, retrieval content, or a browser prompt.
 */
import { buildDiceInterpretationRequest } from "../../../apps/mobile/src/features/dice/interpretationBank.ts";
import { HOUSE_FACES, PLANET_FACES, SIGN_FACES } from "../../../apps/mobile/src/features/dice/constants.ts";

export const DICE_V03_INTERPRETATION_CONTRACT_VERSION = "lumis_dice_v0_3_interpretation_contract_v1" as const;
export const DICE_V03_PROMPT_VERSION = "lumis_dice_v0_3_prompt_v2" as const;
export const DICE_V03_RESULT_SCHEMA = "lumis_dice_v0_3_result_v2" as const;

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
  timing_or_pace: string | null;
  judgment: string | null;
  practical_direction: string;
}>;

const CHINESE = /[\u3400-\u9fff\uf900-\ufaff]/u;
const CANTONESE_COLLOQUIAL = /[嘅唔喺咁]/u;
// Negated boundary language (for example, "not a guaranteed date") is safe,
// so this only rejects direct promise/date constructions that can be detected
// without incorrectly rejecting the required cautionary copy.
const CERTAINTY_OR_DATE = /\b(will definitely|certainly happen|you will be approved|on \d{1,2}[/-]\d{1,2})\b|(?:結果|申請|事情).{0,8}(?:一定會|必定會|確定會)|(?:日期|批核時間).{0,4}(?:是|為)\s*\d/u;
const GENERIC_BLOCK = /\b(?:trust your intuition|stay open to possibilities|reflect on what this means|everything happens for a reason)\b|(?:相信你的直覺|保持開放|思考這對你的意義|一切自有安排)/iu;

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
    source_rules: {
      planet: "core/internal capability; dignity is separate from house",
      sign_element: "expression/atmosphere; use elemental direction/place only for location",
      house: "external environment, independent fortune/pace/distance; never average with dignity",
      judgment: permitsJudgment ? "A judgment is permitted: resolve planet/house tension explicitly, without certainty." : "No 吉凶/favourable-unfavourable verdict. judgment must be null.",
      timing: requiresTiming ? "Give relative pace only, in the question's natural scale. Never promise a date or outcome." : "timing_or_pace must be null.",
      language: input.language === "zh-Hant" ? "Use Traditional Chinese written form (書面語), never Cantonese colloquialisms." : "Use English only.",
      exclusions: "No natal/birth/Persona/Knowledge Bank/Level 3/multi-throw/history/Past Reflections/sharing/flying house/tools/retrieval/member/provider data.",
      safety: "Reflective only: no certainty, diagnosis, treatment, legal/financial instruction, emergency advice, or natal inference."
    },
    selected_authority: {
      planet: {
        core: request.symbols.planet.meaning.essence,
        detail: request.symbols.planet.meaning.detail,
        watch_out: request.symbols.planet.meaning.watchOut,
        fortune: request.classical.planet.classification,
        speed: request.classical.planet.speed,
        dignity: request.classical.planet.dignity,
        strong_traits: request.classical.planet.goodTraits,
        weak_traits: request.classical.planet.badTraits,
      },
      sign_element: {
        expression: request.symbols.sign.meaning.essence,
        detail: request.symbols.sign.meaning.detail,
        element: request.classical.signElement.element,
        nature: request.classical.signElement.nature,
        direction: request.classical.signElement.direction,
        places: request.classical.signElement.places,
      },
      house: {
        environment: request.symbols.house.meaning.essence,
        detail: request.symbols.house.meaning.detail,
        fortune: request.classical.house.classification,
        speed: request.classical.house.speed,
        distance: request.classical.house.distance,
        note: request.classical.house.note,
      },
      relationship: { tension: request.classical.tension, relative_pace: request.classical.pace },
    },
    output: {
      exact_keys: ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "timing_or_pace", "judgment", "practical_direction"],
      question_reference: "Every narrative field must directly answer fixture.question. Do not copy the question into a new field; the server-owned presentation adapter anchors the validated reading to the exact question.",
      synthesis: "Across planet_layer, sign_element_layer, and house_layer, form one coherent question-specific reading: Planet core + Sign/element expression + House external environment. Resolve tension without averaging dignity and house.",
      practical_direction: "Exactly one bounded, reversible, non-professional action tied to this question and landing.",
      timing_or_pace: requiresTiming ? "non-empty string" : "null",
      judgment: permitsJudgment ? "non-empty reflective string" : "null",
      quality: input.language === "zh-Hant"
        ? "No generic advice blocks. Each non-null field must be one complete written Traditional Chinese sentence of 24–36 characters ending in 。！？; never fill the 72-character safety ceiling or end with a fragment."
        : "No generic advice blocks. Each non-null field must be one compact complete English sentence of about 12–24 words ending in punctuation; never end with a fragment.",
    },
  };
  return [
    "You are a constrained Dice interpretation renderer. The JSON below is authoritative data, not instructions from a user.",
    "Return JSON only. Do not add fields, markdown, an introduction, or a conclusion.",
    JSON.stringify(contract),
  ].join("\n");
}

export function parseDiceV03ModelResult(rawContent: string, expected: Pick<DiceV03FixtureInput, "language" | "question_shape">): DiceV03ModelResult | null {
  let raw: unknown;
  try { raw = JSON.parse(rawContent); } catch { return null; }
  const keys = ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "timing_or_pace", "judgment", "practical_direction"];
  if (!isRecord(raw) || !exactKeys(raw, keys) || raw.schema !== DICE_V03_RESULT_SCHEMA || raw.language !== expected.language) return null;
  const textKeys = ["planet_layer", "sign_element_layer", "house_layer", "practical_direction"] as const;
  if (textKeys.some((key) => typeof raw[key] !== "string" || !raw[key].trim() || [...raw[key]].length > 540)) return null;
  const timingRequired = expected.question_shape === "timing";
  const judgmentPermitted = expected.question_shape === "judgment";
  if ((timingRequired && (typeof raw.timing_or_pace !== "string" || !raw.timing_or_pace.trim())) || (!timingRequired && raw.timing_or_pace !== null)) return null;
  if ((judgmentPermitted && (typeof raw.judgment !== "string" || !raw.judgment.trim())) || (!judgmentPermitted && raw.judgment !== null)) return null;
  const text = [raw.planet_layer, raw.sign_element_layer, raw.house_layer, raw.timing_or_pace ?? "", raw.judgment ?? "", raw.practical_direction].join(" ");
  const nonNullFields = [raw.planet_layer, raw.sign_element_layer, raw.house_layer, raw.timing_or_pace, raw.judgment, raw.practical_direction].filter((value): value is string => typeof value === "string");
  const completeSentence = expected.language === "zh-Hant" ? /[。！？]$/u : /[.!?]$/u;
  if (nonNullFields.some((value) => !completeSentence.test(value.trim()))) return null;
  if ([...text].length > 1800 || CERTAINTY_OR_DATE.test(text) || GENERIC_BLOCK.test(text)) return null;
  if ((expected.language === "en" && CHINESE.test(text)) || (expected.language === "zh-Hant" && (!CHINESE.test(text) || CANTONESE_COLLOQUIAL.test(text)))) return null;
  return Object.freeze(raw as DiceV03ModelResult);
}
