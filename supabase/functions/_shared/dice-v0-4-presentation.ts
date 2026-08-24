import { HOUSE_FACES, PLANET_FACES, SIGN_FACES, type DiceFace } from "../../../apps/mobile/src/features/dice/constants.ts";
import {
  DICE_V04_BUNDLED_COPY,
  DICE_V04_ROUTE_REVIEW_COPY,
  type DiceV04JudgmentCode,
  type DiceV04Landing,
  type DiceV04Language,
  type DiceV04Result,
} from "./dice-v0-4-interpretation-contract.ts";

export type DiceV04Section = Readonly<{ heading: string; body?: string; items?: readonly string[] }>;
export type DiceV04Presentation = Readonly<{
  kind: "reading";
  language: DiceV04Language;
  question_mode: DiceV04Result["question_mode"];
  opening: string;
  sections: readonly DiceV04Section[];
}>;
export type DiceV04DeterministicPresentation = Readonly<{
  kind: "route_review" | "bundled" | "safety" | "fallback";
  language: DiceV04Language;
  message: string;
}>;

const JUDGMENT_LABELS: Record<DiceV04JudgmentCode, Readonly<{ en: string; "zh-Hant": string }>> = {
  strongly_favourable: { en: "Strongly favourable", "zh-Hant": "大吉" },
  favourable: { en: "Favourable", "zh-Hant": "吉" },
  mixed_neutral: { en: "Mixed / neutral", "zh-Hant": "平" },
  unfavourable: { en: "Unfavourable", "zh-Hant": "凶" },
  strongly_unfavourable: { en: "Strongly unfavourable", "zh-Hant": "大凶" },
};

const HEADINGS = {
  reading: { en: "Reading", "zh-Hant": "解讀" },
  watch: { en: "One thing to watch", "zh-Hant": "需要留意" },
  practical: { en: "Practical step", "zh-Hant": "實際一步" },
  result: { en: "Result", "zh-Hant": "結果" },
  timing: { en: "Timing", "zh-Hant": "時間節奏" },
  followups: { en: "Suggested follow-up questions", "zh-Hant": "建議延伸問題" },
} as const;
const FOLLOWUP_INTRO = {
  en: "If you want to explore this further, choose one question for a separate throw.",
  "zh-Hant": "如果你想進一步了解，可以選擇以下其中一個問題，另行擲骰。",
} as const;

function face(faces: readonly DiceFace[], key: string): DiceFace {
  const value = faces.find((entry) => entry.key === key);
  if (!value) throw new Error("DICE_V04_PRESENTATION_LANDING_INVALID");
  return value;
}

function splitSynthesis(synthesis: string, language: DiceV04Language): Readonly<{ first: string; rest: string }> {
  const boundary = language === "zh-Hant" ? /^[^。！？]*[。！？]/u : /^[^.!?]*[.!?]/u;
  const match = synthesis.trim().match(boundary);
  if (!match) return { first: synthesis.trim(), rest: "" };
  return { first: match[0].trim(), rest: synthesis.trim().slice(match[0].length).trim() };
}

export function presentDiceV04Result(result: DiceV04Result, landing: DiceV04Landing): DiceV04Presentation {
  const zh = result.language === "zh-Hant";
  const lang = result.language;
  const planet = face(PLANET_FACES, landing.planet);
  const sign = face(SIGN_FACES, landing.sign);
  const house = face(HOUSE_FACES, landing.house);
  const { first, rest } = splitSynthesis(result.synthesis, lang);
  const opening = zh
    ? `你抽到${planet.zh}落在${sign.zh}及${house.zh}。${first}`
    : `You drew ${planet.en} in ${sign.en} in the ${house.en}. ${first}`;
  const reading = rest || result.synthesis.trim();

  const sections: DiceV04Section[] = [];
  if (result.question_mode === "judgment") {
    const label = JUDGMENT_LABELS[result.judgment_code!][lang];
    sections.push({ heading: HEADINGS.result[lang], body: zh ? `${label}——${result.judgment_summary}` : `${label} — ${result.judgment_summary}` });
    sections.push({ heading: HEADINGS.reading[lang], body: reading });
    sections.push({ heading: HEADINGS.watch[lang], body: result.watch_out });
    sections.push({ heading: HEADINGS.followups[lang], body: FOLLOWUP_INTRO[lang], items: result.suggested_followups });
  } else if (result.question_mode === "timing") {
    sections.push({ heading: HEADINGS.timing[lang], body: result.timing_summary! });
    sections.push({ heading: HEADINGS.reading[lang], body: reading });
    sections.push({ heading: HEADINGS.watch[lang], body: result.watch_out });
    sections.push({ heading: HEADINGS.practical[lang], body: result.practical_step! });
  } else {
    sections.push({ heading: HEADINGS.reading[lang], body: reading });
    sections.push({ heading: HEADINGS.watch[lang], body: result.watch_out });
    sections.push({ heading: HEADINGS.practical[lang], body: result.practical_step! });
  }
  return Object.freeze({ kind: "reading", language: lang, question_mode: result.question_mode, opening, sections: Object.freeze(sections) });
}

const SAFETY_COPY = Object.freeze({
  en: "Lumis can’t help with that request, but it can offer a safer, general reflection instead.",
  "zh-Hant": "Lumis 無法協助這項要求，但可以改為提供較安全、概括的反思。",
});
const FALLBACK_COPY = Object.freeze({
  en: "Lumis couldn’t complete that reflection just now. Please try again.",
  "zh-Hant": "Lumis 暫時未能完成這次反思，請再試一次。",
});

export function presentDiceV04Deterministic(kind: DiceV04DeterministicPresentation["kind"], language: DiceV04Language): DiceV04DeterministicPresentation {
  const message = kind === "route_review" ? DICE_V04_ROUTE_REVIEW_COPY[language]
    : kind === "bundled" ? DICE_V04_BUNDLED_COPY[language]
    : kind === "safety" ? SAFETY_COPY[language]
    : FALLBACK_COPY[language];
  return Object.freeze({ kind, language, message });
}
