// Founder-directed basic natal Knowledge Bank for the Lab (planet-in-sign grounding only).
//
// Content is transcribed VERBATIM from the Founder-Approved controlled interpretation bank
// `Lumis_Knowledge_Bank_Founder_Interpretation_Bank_First_Controlled_Draft_2026-07-28.xlsx`
// (Signs + Planets sheets, all rows "Founder Approved"). Nothing here is invented — per KB Answer
// Rule ANS-01 the model may only use rows present in the approved bank.
//
// Scope boundaries honoured for the Lab (no birth time is collected):
//   - Planet-in-SIGN facts only. Houses, angles, aspects, chart rulers and time-sensitive factors
//     are excluded (KB Technical Base §4 birth-time gate; Answer Rule ANS-07).
//   - Moon is a fact only when the Lab's Moon-confirmed flag is set (unconfirmed Moon is suppressed,
//     never inferred — Persona v1.2 Moon-certainty rule + ANS-07).
//   - Six-fact retrieval budget (KB-TB-04); the Lab collects Sun/Moon/Mercury/Saturn, so ≤4.
//   - Natal only; Solar Return excluded entirely (ANS-12).

export type NatalFact = {
  planet: "sun" | "moon" | "mercury" | "saturn";
  planet_name: string;
  sign: number;
  sign_name: string;
  what: string;   // planet core function ("what")
  how: string;    // sign core drive ("how")
  keywords: string;
  composed: string;
  grounding: string; // combined AI grounding guardrails (planet + sign)
};

type SignRow = { name: string; element: string; modality: string; coreDrive: string; keywords: string; grounding: string };
type PlanetRow = { name: string; coreFunction: string; role: string; grounding: string };

// ---- Signs (Founder Approved) ----
const SIGN_BANK: Record<number, SignRow> = {
  1: { name: "Aries", element: "fire", modality: "cardinal", coreDrive: "initiation and direct engagement", keywords: "initiative, courage, urgency, independence, competition, challenge, innovation", grounding: "Use for beginnings, assertion and courage. Do not label reckless by default." },
  2: { name: "Taurus", element: "earth", modality: "fixed", coreDrive: "stability, embodiment and sustained value", keywords: "stability, senses, resources, patience, consistency, comfort", grounding: "Use for resources, consistency and attachment. Do not equate slowness with laziness." },
  3: { name: "Gemini", element: "air", modality: "mutable", coreDrive: "curiosity, exchange and mental flexibility", keywords: "curiosity, language, options, learning, connection, variety", grounding: "Use for learning and communication. Do not assume superficiality." },
  4: { name: "Cancer", element: "water", modality: "cardinal", coreDrive: "protection, belonging and emotional continuity", keywords: "home, memory, protection, care, belonging, sensitivity", grounding: "Use for family, care and belonging. Do not assume dependency." },
  5: { name: "Leo", element: "fire", modality: "fixed", coreDrive: "creative self-expression and visibility", keywords: "visibility, creativity, pride, warmth, play, recognition", grounding: "Use for confidence and creativity. Do not equate visibility with vanity." },
  6: { name: "Virgo", element: "earth", modality: "mutable", coreDrive: "discernment, improvement and practical service", keywords: "discernment, routine, analysis, repair, skill, usefulness", grounding: "Use for routine, skill and repair. Avoid pathologising health concerns or perfectionism." },
  7: { name: "Libra", element: "air", modality: "cardinal", coreDrive: "balance, relationship and fair exchange", keywords: "balance, relating, fairness, aesthetics, negotiation, reciprocity", grounding: "Use for relationships and negotiation. Distinguish harmony from self-erasure." },
  8: { name: "Scorpio", element: "water", modality: "fixed", coreDrive: "depth, trust and concentrated transformation", keywords: "depth, trust, intimacy, power, secrecy, resilience, transformation", grounding: "Use for trust, power and endings. Avoid assumptions about trauma, betrayal or manipulation." },
  9: { name: "Sagittarius", element: "fire", modality: "mutable", coreDrive: "meaning, exploration and expanding perspective", keywords: "meaning, travel, belief, optimism, truth, teaching, possibility", grounding: "Use for meaning and freedom. Avoid assuming optimism removes consequences." },
  10: { name: "Capricorn", element: "earth", modality: "cardinal", coreDrive: "structure, responsibility and long-term achievement", keywords: "structure, responsibility, ambition, time, authority, endurance", grounding: "Use for career, boundaries and responsibility. Avoid equating worth with productivity." },
  11: { name: "Aquarius", element: "air", modality: "fixed", coreDrive: "independence, systems and future-oriented perspective", keywords: "difference, systems, future, community, innovation, objectivity", grounding: "Use for individuality, groups and systems. Do not assume emotional coldness." },
  12: { name: "Pisces", element: "water", modality: "mutable", coreDrive: "empathy, imagination and permeable connection", keywords: "empathy, dreams, surrender, sensitivity, imagination, spirituality", grounding: "Use for compassion and creativity. Name boundaries and clarity where relevant." },
};

// ---- Planets (Core; Founder Approved) — only those the Lab collects ----
const PLANET_BANK: Record<NatalFact["planet"], PlanetRow> = {
  sun: { name: "Sun", coreFunction: "identity, vitality and conscious direction", role: "what the person is learning to embody and stand behind", grounding: "Use for identity, confidence, purpose and being seen. Do not equate confidence with superiority." },
  moon: { name: "Moon", coreFunction: "emotional rhythm, instinct and safety needs", role: "what the inner system reaches for under stress and in private life", grounding: "Use for mood, comfort, family imprint and private self. Avoid diagnosing mental health." },
  mercury: { name: "Mercury", coreFunction: "thinking, learning and communication", role: "how the mind connects, categorises and expresses ideas", grounding: "Use for communication, learning, choices and misunderstandings. Distinguish thought from feeling." },
  saturn: { name: "Saturn", coreFunction: "structure, limits and responsibility", role: "where maturity develops through time, limits and responsibility", grounding: "Use for boundaries, work, pressure, commitment and mastery. Avoid punishment or doom language." },
};

// KB Answer Rules that constrain HOW the grounding is used (transcribed guardrails).
export const KB_ANSWER_RULES = [
  "Compose meaning as planet = what, sign = how — do not just list keywords or produce a string of stereotypes (ANS-02).",
  "Use conditional, reflective language (may, can, tends to, could help). Avoid destiny, certainty, punishment, guaranteed luck, or universal good/bad labels (ANS-05).",
  "Answer the person's actual message; do not dump the whole chart when they asked one thing (ANS-06).",
  "Use only the facts below — never add an astrology fact that is not in this list (ANS-01).",
  "No houses, angles, timing, or Solar Return (no birth time is available here) (ANS-07/ANS-12).",
] as const;

export type NatalRetrieval = { facts: NatalFact[]; suppressed: Array<{ planet: string; reason: string }> };

// Retrieve the person's planet-in-sign facts for their entered chart (their OWN signs, not the
// derived Companion signs). Moon suppressed unless confirmed. Capped at the six-fact budget.
export function retrieveNatalFacts(chart: { sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean }): NatalRetrieval {
  const facts: NatalFact[] = [];
  const suppressed: Array<{ planet: string; reason: string }> = [];
  const order: Array<{ planet: NatalFact["planet"]; sign: number; gated?: boolean }> = [
    { planet: "sun", sign: chart.sun },
    { planet: "moon", sign: chart.moon, gated: !chart.moon_confirmed },
    { planet: "mercury", sign: chart.mercury },
    { planet: "saturn", sign: chart.saturn },
  ];
  for (const item of order) {
    if (item.gated) { suppressed.push({ planet: PLANET_BANK[item.planet].name, reason: "Moon unconfirmed by birth time — sign not inferred (ANS-07 / Persona Moon-certainty rule)." }); continue; }
    const s = SIGN_BANK[item.sign]; const pl = PLANET_BANK[item.planet];
    if (!s || !pl) continue;
    facts.push({
      planet: item.planet, planet_name: pl.name, sign: item.sign, sign_name: s.name,
      what: pl.coreFunction, how: s.coreDrive, keywords: s.keywords,
      composed: `${pl.name} in ${s.name} — ${pl.coreFunction}, expressed through ${s.coreDrive}.`,
      grounding: `${pl.grounding} ${s.grounding}`.trim(),
    });
    if (facts.length >= 6) break;
  }
  return { facts, suppressed };
}

// The grounding block injected into the persona prompt for generative routes.
// Kept lean and non-clinical: the per-row AI grounding guardrails (which contain safety-adjacent
// words such as "mental health"/"trauma") are NOT concatenated into the live prompt, because that
// wall of clinical phrasing trips the provider's content/jailbreak shield. The facts plus a short,
// gentle instruction carry the same intent (Answer Rules ANS-01/02/05/06).
export function buildKnowledgeGrounding(retrieval: NatalRetrieval): string | null {
  if (!retrieval.facts.length) return null;
  const lines: string[] = [];
  lines.push("Chart-grounded facts you may draw on for interpretation ONLY when the conversation calls for it — the member profile above already shapes your delivery, so treat these as optional background, not something to recite:");
  for (const f of retrieval.facts) lines.push(`- ${f.composed}`);
  lines.push("Keep it tentative (may, can, tends to), stay within what's listed here, and don't mention placements or astrology unless it genuinely adds to what they actually said.");
  return lines.join("\n");
}
