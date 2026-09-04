/**
 * Dice v5 — resolve-and-inject builders (Stage-2 `given` envelopes, §10),
 * the system final-object assembler (`lumis_dice_interpretation_v5`, §12.4/§14),
 * short-key→global-id expansion (§16) and the four-part presentation contract
 * (§18). Self-contained; imports the v5 fixed-data + contract only.
 */
import {
  DICE_V05_RESULT_SCHEMA, type DiceV05Language, type DiceV05PlanetId, type DiceV05SignId,
  PLANET_TABLE, HOUSE_TABLE, SIGN_ELEMENT, SIGN_ESSENCE, ELEMENT_TABLE, dignityOf, combinedPaceV05,
  LOCATION_PLANET_BANK, LOCATION_HOUSE_BANK,
} from "./dice-v0-5-fixed-data.ts";
import {
  type DiceV05Landing, type DiceV05Stage2Mode, type DiceV05Mode,
  buildLanding, stage2ModeOf, type LocationSelectedKeys,
} from "./dice-v0-5-interpretation-contract.ts";

/* ---------------- Stage-2 `given` envelope builders (§10) ---------------- */
export function buildJudgmentEnvelope(language: DiceV05Language, question: string, planet: DiceV05PlanetId, sign: DiceV05SignId, house: number) {
  const p = PLANET_TABLE[planet], h = HOUSE_TABLE[house], d = dignityOf(planet, sign);
  const emphasis = d.strength === "strong" ? "constructive" : d.strength === "weak" ? "difficult" : "balanced";
  return Object.freeze({ language, question, mode: "judgment", given: Object.freeze({
    landing: buildLanding(planet, sign, house),
    planet_fortune: p.fortune, planet_fortune_zh: p.fortune_zh,
    dignity: d.dignity, dignity_zh: d.dignity_zh, strength: d.strength,
    constructive_traits: language === "zh-Hant" ? p.constructive_zh : p.constructive_en,
    difficult_traits: language === "zh-Hant" ? p.difficult_zh : p.difficult_en,
    dignity_emphasis: emphasis,
    house_fortune: h.fortune, house_fortune_zh: h.fortune_zh, house_rank: h.rank,
  }) });
}

export function buildTimingEnvelope(language: DiceV05Language, question: string, planet: DiceV05PlanetId, sign: DiceV05SignId, house: number) {
  const p = PLANET_TABLE[planet], h = HOUSE_TABLE[house], d = dignityOf(planet, sign);
  return Object.freeze({ language, question, mode: "timing", given: Object.freeze({
    landing: buildLanding(planet, sign, house),
    planet_speed: p.speed, house_speed: h.speed, combined_pace: combinedPaceV05(p.speed, h.speed),
    dignity: d.dignity, dignity_zh: d.dignity_zh, dignity_strength: d.strength,
  }) });
}

export function buildLevel1Envelope(mode: "person" | "reason" | "thing_or_situation", language: DiceV05Language, question: string, planet: DiceV05PlanetId, sign: DiceV05SignId, house: number) {
  const p = PLANET_TABLE[planet], h = HOUSE_TABLE[house], d = dignityOf(planet, sign), s = SIGN_ESSENCE[sign];
  return Object.freeze({ language, question, mode, given: Object.freeze({
    landing: buildLanding(planet, sign, house),
    planet_essence: language === "zh-Hant" ? p.essence_zh : p.essence_en,
    planet_detail: language === "zh-Hant" ? p.detail_zh : p.detail_en,
    sign_essence: language === "zh-Hant" ? s.essence_zh : s.essence_en,
    sign_detail: language === "zh-Hant" ? s.detail_zh : s.detail_en,
    house_essence: language === "zh-Hant" ? h.essence_zh : h.essence_en,
    house_detail: language === "zh-Hant" ? h.detail_zh : h.detail_en,
    dignity_strength: d.strength,
  }) });
}

/* ---------------- Location wire payload + selected keys + gid map (§16) ---------------- */
export type LocationResolution = Readonly<{
  envelope: Record<string, unknown>;
  selectedKeys: LocationSelectedKeys;
  gid: Readonly<Record<string, string>>; // short key -> global id
}>;
export function buildLocationResolution(language: DiceV05Language, planet: DiceV05PlanetId, sign: DiceV05SignId, house: number): LocationResolution {
  const zh = language === "zh-Hant";
  const pb = LOCATION_PLANET_BANK[planet], hb = LOCATION_HOUSE_BANK[house], el = SIGN_ELEMENT[sign], et = ELEMENT_TABLE[el], hr = HOUSE_TABLE[house];
  const gid: Record<string, string> = {};
  // Compact permanent wire codes -> stable semantic global ids. The code carries no astrology; the
  // gid is the reader-facing id the server expands to. planet: pt=theme, px=context, p01..=related;
  // house: ht=setting, hx=context, h01..=related; element: e01..=places. Each related/element code
  // is the EXPLICIT `code` STORED on the bank entry (dice-v0-5-fixed-data.ts) — never derived from
  // list position, so reordering or inserting a bank entry never changes an existing code's meaning.
  // LOSSLESS COMPACT WIRE ENCODING: related/element places are serialised as a single {code:text}
  // map per group (not an array of {k,t} objects), removing per-place key scaffolding while keeping
  // every place, its permanent code and full text; theme/context/setting keep their role labels.
  const pKeys: string[] = [], hKeys: string[] = [], eKeys: string[] = [];
  const pRelated: Record<string, string> = {}; pb.related.forEach((r) => { const k = r.code; gid[k] = `planet.${planet}.related.${r.slug}`; pRelated[k] = zh ? r.zh : r.en; pKeys.push(k); });
  const hRelated: Record<string, string> = {}; hb.related.forEach((r) => { const k = r.code; gid[k] = `house.${house}.related.${r.slug}`; hRelated[k] = zh ? r.zh : r.en; hKeys.push(k); });
  const ePlaces: Record<string, string> = {}; et.places.forEach((r) => { const k = r.code; gid[k] = `element.${el.toLowerCase()}.${r.slug}`; ePlaces[k] = zh ? r.zh : r.en; eKeys.push(k); });
  gid["pt"] = `planet.${planet}.theme`; gid["px"] = `planet.${planet}.context`;
  gid["ht"] = `house.${house}.setting`; gid["hx"] = `house.${house}.context`;
  const envelope = { language, question: "", mode: "location", given: {
    planet_place: { id: planet, theme: { k: "pt", t: zh ? pb.theme_zh : pb.theme_en }, related: pRelated, context: { k: "px", t: zh ? pb.context_zh : pb.context_en } },
    house_place: { id: `house_${house}`, distance: hr.distance, setting: { k: "ht", t: zh ? hb.setting_zh : hb.setting_en }, related: hRelated, context: { k: "hx", t: zh ? hb.context_zh : hb.context_en } },
    sign_element: { element: el, direction: et.direction, places: ePlaces },
  } };
  return Object.freeze({
    envelope,
    selectedKeys: Object.freeze({ p: ["pt", "px", ...pKeys], h: ["ht", "hx", ...hKeys], e: eKeys }),
    gid: Object.freeze(gid),
  });
}

/* ---------------- Final assembled result (§12.4) ---------------- */
const NULL_LOCATION = { most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null };
export function assembleJudgment(language: DiceV05Language, landing: DiceV05Landing, v: Record<string, any>): Record<string, unknown> {
  const p = PLANET_TABLE[landing.planet_id], h = HOUSE_TABLE[landing.house_number], d = dignityOf(landing.planet_id, landing.sign_id);
  const emphasis = d.strength === "strong" ? "constructive" : d.strength === "weak" ? "difficult" : "balanced";
  return finalize({
    language, question_mode: "judgment",
    planet_side: { fortune: p.fortune, fortune_zh: p.fortune_zh, dignity: d.dignity, dignity_zh: d.dignity_zh, strength: d.strength,
      constructive_traits: language === "zh-Hant" ? p.constructive_zh : p.constructive_en, difficult_traits: language === "zh-Hant" ? p.difficult_zh : p.difficult_en,
      dignity_emphasis: emphasis, prose: v.planet_prose },
    house_side: { fortune: h.fortune, fortune_zh: h.fortune_zh, rank: h.rank, prose: v.house_prose },
    ...NULL_LOCATION, synthesis: v.synthesis, timing_summary: null, watch_out: v.watch_out, practical_step: null, suggested_followups: v.suggested_followups,
  });
}
export function assembleTiming(language: DiceV05Language, _landing: DiceV05Landing, v: Record<string, any>): Record<string, unknown> {
  return finalize({ language, question_mode: "timing", planet_side: null, house_side: null, ...NULL_LOCATION, synthesis: v.synthesis, timing_summary: v.timing_summary, watch_out: v.watch_out ?? null, practical_step: null, suggested_followups: [] });
}
export function assembleLevel1(language: DiceV05Language, mode: "person" | "reason" | "thing_or_situation", v: Record<string, any>): Record<string, unknown> {
  return finalize({ language, question_mode: mode, planet_side: null, house_side: null, ...NULL_LOCATION, synthesis: v.synthesis, timing_summary: null, watch_out: v.watch_out, practical_step: v.practical_step, suggested_followups: [] });
}
export function assembleLocation(language: DiceV05Language, v: Record<string, any>, gid: Readonly<Record<string, string>>): Record<string, unknown> {
  const map = (arr: string[]) => arr.map((k) => gid[k]).filter((x): x is string => typeof x === "string");
  const candidates = (v.location_candidates as any[]).map((c) => ({ rank: c.rank, place: c.place, evidence: { planet_ids: map(c.evidence.p), house_ids: map(c.evidence.h), element_ids: map(c.evidence.e) } }));
  const ext = v.extension ? { candidate_rank: v.extension.candidate_rank, source_id: gid[v.extension.src], relationship: v.extension.relationship } : null;
  return finalize({ language, question_mode: "location", planet_side: null, house_side: null,
    most_likely_area: v.most_likely_area, location_candidates: candidates, location_extension: ext, location_search_order: v.search_order,
    synthesis: v.synthesis, timing_summary: null, watch_out: v.watch_out, practical_step: v.practical_step, suggested_followups: [] });
}
export function assembleRouteReview(language: DiceV05Language, questionMode: DiceV05Mode): Record<string, unknown> {
  return finalize({ language, status: "route_review_required", question_mode: questionMode, planet_side: null, house_side: null, ...NULL_LOCATION, synthesis: null, timing_summary: null, watch_out: null, practical_step: null, suggested_followups: [] });
}
function finalize(body: Record<string, unknown>): Record<string, unknown> {
  return Object.freeze({ schema: DICE_V05_RESULT_SCHEMA, status: (body.status as string) ?? "ok", ...stripStatus(body) });
}
function stripStatus(b: Record<string, unknown>): Record<string, unknown> { const { status, ...rest } = b; void status; return rest; }

/* ---------------- Presentation (§18) ---------------- */
export type PresentationSection = Readonly<{ heading: string; body: string; items?: readonly string[] }>;
export type Presentation = Readonly<{ kind: "reading" | "route_review"; language: DiceV05Language; opening: string; sections: readonly PresentationSection[] }>;

const HEAD = {
  reading: { en: "Reading", "zh-Hant": "解讀" }, watch: { en: "One thing to watch", "zh-Hant": "需要留意" },
  practical: { en: "Practical step", "zh-Hant": "實際一步" }, result: { en: "Result", "zh-Hant": "結果" },
  timing: { en: "Timing", "zh-Hant": "時間節奏" }, followups: { en: "Suggested follow-up questions", "zh-Hant": "建議延伸問題" },
  area: { en: "Most likely area", "zh-Hant": "最有可能的範圍" }, candidates: { en: "Where to look", "zh-Hant": "建議尋找位置" },
} as const;

export function presentV05(final: Record<string, any>): Presentation {
  const language = final.language as DiceV05Language;
  const opening = openingLine(final, language);
  if (final.status === "route_review_required") return Object.freeze({ kind: "route_review", language, opening: "", sections: [] });
  const H = (k: keyof typeof HEAD) => HEAD[k][language];
  const sections: PresentationSection[] = [];
  const mode = final.question_mode as string;
  if (mode === "judgment") {
    const ps = final.planet_side, hs = final.house_side;
    sections.push({ heading: H("result"), body: `${ps.prose} ${hs.prose}` });
    sections.push({ heading: H("reading"), body: final.synthesis });
    sections.push({ heading: H("watch"), body: final.watch_out });
    sections.push({ heading: H("followups"), body: "", items: final.suggested_followups });
  } else if (mode === "timing") {
    sections.push({ heading: H("timing"), body: final.timing_summary });
    sections.push({ heading: H("reading"), body: final.synthesis });
    if (final.watch_out) sections.push({ heading: H("watch"), body: final.watch_out });
  } else if (mode === "location") {
    sections.push({ heading: H("area"), body: final.most_likely_area });
    sections.push({ heading: H("reading"), body: final.synthesis });
    const order: number[] = final.location_search_order;
    const byRank = new Map<number, any>(final.location_candidates.map((c: any) => [c.rank, c]));
    sections.push({ heading: H("candidates"), body: "", items: order.map((r) => byRank.get(r)?.place).filter(Boolean) });
    sections.push({ heading: H("watch"), body: final.watch_out });
    sections.push({ heading: H("practical"), body: final.practical_step });
  } else {
    sections.push({ heading: H("reading"), body: final.synthesis });
    sections.push({ heading: H("watch"), body: final.watch_out });
    sections.push({ heading: H("practical"), body: final.practical_step });
  }
  return Object.freeze({ kind: "reading", language, opening, sections: Object.freeze(sections) });
}
function openingLine(final: Record<string, any>, language: DiceV05Language): string {
  // The full physical landing lives on the outer dice-result envelope; presentation
  // is given the interpretation object, so the opening is the mode heading only.
  const zh = language === "zh-Hant";
  const mode = final.question_mode as string;
  if (mode === "judgment") return zh ? "判斷" : "Judgment";
  if (mode === "timing") return zh ? "時間節奏" : "Timing";
  if (mode === "location") return zh ? "位置" : "Location";
  return zh ? "描述解讀" : "Descriptive reading";
}

export { stage2ModeOf };
export type { DiceV05Stage2Mode };
