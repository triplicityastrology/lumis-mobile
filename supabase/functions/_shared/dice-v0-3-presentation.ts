import { HOUSE_FACES, PLANET_FACES, SIGN_FACES, type DiceFace } from "../../../apps/mobile/src/features/dice/constants.ts";
import {
  DICE_ROUTE_MISMATCH_COPY,
  type DiceV03FixtureInput,
  type DiceV03Language,
  type DiceV03ModelResult,
} from "./dice-v0-3-interpretation-contract.ts";

export type DiceV03Presentation = Readonly<{
  opening: string;
  sections: readonly Readonly<{ heading: string; body: string }>[];
}>;

export type DiceV03DeterministicPresentation = Readonly<{
  kind: "route_mismatch" | "safety" | "fallback";
  language: DiceV03Language;
  message: string;
}>;

function face(faces: readonly DiceFace[], key: string): DiceFace {
  const value = faces.find((entry) => entry.key === key);
  if (!value) throw new Error("DICE_V03_PRESENTATION_LANDING_INVALID");
  return value;
}

// Split synthesis into (first sentence, remaining sentences). The opening line
// carries only the first sentence; the Reading renders the rest — so the
// opening is never repeated inside the Reading (founder correction, 2026-08-23).
function splitSynthesis(synthesis: string, language: DiceV03Language): Readonly<{ first: string; rest: string }> {
  const boundary = language === "zh-Hant" ? /^[^。！？]*[。！？]/u : /^[^.!?]*[.!?]/u;
  const match = synthesis.trim().match(boundary);
  if (!match) return { first: synthesis.trim(), rest: "" };
  const first = match[0].trim();
  const rest = synthesis.trim().slice(match[0].length).trim();
  return { first, rest };
}

export function presentDiceV03Result(
  result: DiceV03ModelResult,
  fixture: Pick<DiceV03FixtureInput, "question" | "language" | "outcome">,
): DiceV03Presentation {
  if (result.language !== fixture.language) {
    throw new Error("DICE_V03_PRESENTATION_IDENTITY_MISMATCH");
  }
  const planet = face(PLANET_FACES, fixture.outcome.planet);
  const sign = face(SIGN_FACES, fixture.outcome.sign);
  const house = face(HOUSE_FACES, fixture.outcome.house);
  const zh = result.language === "zh-Hant";
  const { first, rest } = splitSynthesis(result.synthesis, result.language);
  // Opening: unheaded identification line + the first synthesis sentence.
  const opening = zh
    ? `你抽到${planet.zh}落在${sign.zh}及${house.zh}。${first}`
    : `You drew ${planet.en} in ${sign.en} in the ${house.en}. ${first}`;
  // Reading: the remaining synthesis (falls back to the whole synthesis only if
  // the model returned a single sentence, which the validator normally rejects).
  const reading = rest || result.synthesis.trim();
  const headings = zh
    ? ["解讀", "需要留意", "實際一步"]
    : ["Reading", "One thing to watch", "Practical step"];
  return Object.freeze({
    opening,
    sections: Object.freeze([
      Object.freeze({ heading: headings[0], body: reading }),
      Object.freeze({ heading: headings[1], body: result.watch_out }),
      Object.freeze({ heading: headings[2], body: result.practical_direction }),
    ]),
  });
}

const SAFETY_COPY = Object.freeze({
  en: "Lumis can’t help with that request, but it can offer a safer, general reflection instead.",
  "zh-Hant": "Lumis 無法協助這項要求，但可以改為提供較安全、概括的反思。",
});
const FALLBACK_COPY = Object.freeze({
  en: "Lumis couldn’t complete that reflection just now. Please try again.",
  "zh-Hant": "Lumis 暫時未能完成這次反思，請再試一次。",
});

// Deterministic, author-controlled copy for non-normal results. The route-mismatch
// message is distinct from the bundled-question and technical-fallback copy.
export function presentDiceV03Deterministic(
  kind: "route_mismatch" | "safety" | "fallback",
  language: DiceV03Language,
): DiceV03DeterministicPresentation {
  const message = kind === "route_mismatch" ? DICE_ROUTE_MISMATCH_COPY[language]
    : kind === "safety" ? SAFETY_COPY[language]
    : FALLBACK_COPY[language];
  return Object.freeze({ kind, language, message });
}
