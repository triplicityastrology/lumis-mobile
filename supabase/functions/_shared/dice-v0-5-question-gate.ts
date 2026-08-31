/**
 * v5-specific Stage-0 question-boundary gate (§20.1).
 *
 * This wraps the shared v3 classifier WITHOUT modifying it or changing v3 behaviour: the
 * v3 module (`packages/shared/src/config/dice-question-boundary.ts`) is imported read-only and
 * remains the gate for the v3 default path. The v5 free-text window calls THIS gate instead.
 *
 * It corrects three v3/v5 divergences that are settled by §20.1 (not new Founder decisions):
 *   1. Bundled (RT-17): a genuine second appended question in Cantonese —
 *      "<decision> …，其實我又想知 <interrogative>" — is rejected as bundled at Stage-0 with
 *      zero provider calls. The v3 gate misses this because the connective is "又想知" (not
 *      an English "and also …" and not a second "？").
 *   2. Single judgment restated as an evaluative either/or (RT-18): "…, or is it a bad idea?"
 *      / "… or not?" is ONE decision, so it is accepted and left for Stage-1 to route to
 *      judgment — not rejected as two separate choices.
 *   3. Meaningful but genuinely route-ambiguous (RT-19): a substantive question that does not
 *      end in "？" and does not open with a recognised interrogative is accepted so Stage-1 can
 *      return route_review_required — not rejected as unclear.
 *
 * Everything else (input validation, empty, oversize, safety, professional, scope, the
 * English "and also …" bundle, the multi-"？" bundle, genuine A-or-B choices, real unclear
 * inputs) is delegated to v3 unchanged.
 */
import {
  classifyDiceQuestionRequest,
  normalizeDiceQuestionText,
  detectDiceQuestionLanguage,
  DICE_QUESTION_BOUNDARY_VERSION,
  type DiceQuestionDecision,
  type DiceInterpretationRoute,
  type DiceQuestionShape,
} from "../../../packages/shared/src/config/dice-question-boundary.ts";

export const DICE_V05_QUESTION_GATE_VERSION = "dice-v0-5-question-gate-1" as const;

const NO_EFFECTS = Object.freeze({ provider_calls: 0 as const, persistence_writes: 0 as const, units_consumed: 0 as const });

/**
 * A genuine second, appended question ("<complete first question>, …又想知 <second question>").
 * Bundling is decided STRUCTURALLY, not by searching the whole sentence: an additive "also want
 * to know/ask" connective must SEPARATE a complete substantive first intention (before it) from a
 * genuinely different interrogative intention (after it). A single question that merely opens with
 * such a connective ("我又想知佢會唔會返嚟？") has no first intention before the connective and is
 * therefore NOT bundled; a clause expressing doubt about the SAME matter ("但…唔肯定係咪應該繼續")
 * has no additive "want to know/ask" connective and is not bundled either.
 */
// GLOBAL so we can scan EVERY additive connective in the question (matchAll), not just the first.
const V05_ADDITIONAL_ASK_CONNECTIVE = /(?:又|亦|仲|另外|同埋)(?:\s*(?:我|你|佢))?\s*(?:想|要)(?:知|問)/gu;
// A distinct interrogative focus (checked ONLY in the text AFTER a connective). Covers when/where/
// who/why/how/what-kind forms across written Chinese and Cantonese.
const V05_SECOND_INTERROGATIVE = /(?:幾時|何時|幾耐|幾類|邊度|邊個|邊間|點解|幾多|係咪應該|應唔應該|會唔會|點樣|如何|咩|乜|什麼|甚麼|哪裡|何處|誰|為何|怎樣)/u;
// Markers that a clause is itself a substantive question/decision (checked in the text BEFORE a
// connective, to confirm a complete FIRST intention already stands there).
const V05_FIRST_INTENTION_MARKER = /(?:應唔應該|應該|會唔會|係咪|定係|使唔使|值唔值得|好唔好|得唔得|可唔可以|幾時|何時|邊度|邊個|點解|點算|點樣|如何|咩|乜|什麼|甚麼|哪裡|何處|誰|為何|怎樣|[?？])/u;
// Leading filler / pronouns / additive adverbs that do NOT by themselves constitute a first
// intention; stripped from the prefix so a bare "我" / "其實我" reads as empty.
const V05_LEADING_FILLER = /^(?:其實|另外|不過|但係|咁|而家|我|你|佢|又|亦|仲|想|要|知|問|請問|唔該|，|,|、|\s)+/u;

/** "…, or is it a bad idea / or not / 好唔好 / 定唔定" — an evaluative restatement of ONE decision. */
const V05_EVALUATIVE_EITHER_OR: readonly RegExp[] = [
  /,?\s*or\s+(?:is\s+(?:it|that)\s+)?(?:really\s+)?(?:a\s+)?(?:bad|good|wrong|right|unwise|wise|foolish|risky|smart|dumb|stupid|ok|okay|fine|mistake)\b/iu,
  /,?\s*or\s+(?:not|should\s+i\s+not|shouldn'?t\s+i)\b/iu,
  /(?:好唔好|定唔定|得唔得|啱唔啱|值唔值得)\s*呢?\s*[?？]?$/u,
];

/** A substantive question that carries a clear intent/topic even without terminal "？". */
const V05_SUBSTANTIVE_MARKER = /(?:想知|想問|會點|會唔會|應該|應唔應該|係咪|點算|如何|點樣|發展|繼續|可唔可以|值唔值得|應唔應|下一步)/u;

// A complete substantive first intention: after stripping leading filler/pronouns, real content
// remains AND it carries its own question/decision marker.
function isCompleteFirstIntention(before: string): boolean {
  const core = before.replace(V05_LEADING_FILLER, "");
  return [...core].length >= 2 && V05_FIRST_INTENTION_MARKER.test(before);
}
function isV05Bundled(question: string): boolean {
  // Scan EVERY additive connective; the question is bundled if ANY split has a complete first
  // intention before it AND a distinct interrogative after it (a later "另外我想知 …" can be the real
  // second question even when the first connective's prefix is only a pronoun). matchAll is
  // non-stateful per call here because the regex is used only inside this loop.
  for (const m of question.matchAll(V05_ADDITIONAL_ASK_CONNECTIVE)) {
    const idx = m.index ?? 0;
    const before = question.slice(0, idx);
    const after = question.slice(idx + m[0].length);
    if (isCompleteFirstIntention(before) && V05_SECOND_INTERROGATIVE.test(after)) return true;
  }
  return false;
}
function isV05EvaluativeEitherOr(question: string): boolean {
  const lowered = question.toLocaleLowerCase("en-US");
  return V05_EVALUATIVE_EITHER_OR.some((re) => re.test(lowered) || re.test(question));
}
function isV05Substantive(question: string): boolean {
  return [...question].length >= 10 && V05_SUBSTANTIVE_MARKER.test(question);
}

function acceptedDecision(
  question: string,
  route: DiceInterpretationRoute,
  shape: DiceQuestionShape,
): DiceQuestionDecision {
  return {
    accepted: true,
    boundary_version: DICE_QUESTION_BOUNDARY_VERSION,
    effects: NO_EFFECTS,
    language: detectDiceQuestionLanguage(question),
    normalized_question: question,
    route,
    shape,
  };
}
function bundledDecision(): DiceQuestionDecision {
  return { accepted: false, boundary_version: DICE_QUESTION_BOUNDARY_VERSION, code: "DICE_QUESTION_BUNDLED", effects: NO_EFFECTS };
}

export function classifyDiceV05QuestionRequest(input: unknown): DiceQuestionDecision {
  const base = classifyDiceQuestionRequest(input);

  // Only reinterpret when the raw input is a well-formed { question: string }; anything the v3
  // gate rejected for a structural/safety/scope reason is returned exactly as-is.
  const raw = isRecord(input) && typeof input.question === "string" ? normalizeDiceQuestionText(input.question) : null;
  if (raw === null || raw === "") return base;

  // (1) v5 bundled override — a genuine appended second question the v3 gate accepts (RT-17).
  if (base.accepted && isV05Bundled(raw)) return bundledDecision();

  if (!base.accepted) {
    // (2) A single judgment restated as an evaluative either/or was rejected as a choice (RT-18).
    if (base.code === "DICE_CHOICE_REQUIRES_SEPARATE_THROWS" && !isV05Bundled(raw) && isV05EvaluativeEitherOr(raw)) {
      return acceptedDecision(raw, "judgment", "judgment");
    }
    // (3) A meaningful, genuinely route-ambiguous question was rejected as unclear (RT-19):
    //     accept it so Stage-1 can return route_review_required. Still exclude real bundles.
    if (base.code === "DICE_QUESTION_UNCLEAR" && !isV05Bundled(raw) && isV05Substantive(raw)) {
      return acceptedDecision(raw, "descriptive_reflection", "open_reflection");
    }
  }
  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
