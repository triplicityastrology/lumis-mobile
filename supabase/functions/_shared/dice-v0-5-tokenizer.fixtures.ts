/**
 * v5 production-tokenizer fixture (§21). Uses the SAME encoder as the runtime
 * tokenizer `dice-tokenizer-v1.ts`: o200k_base via js-tiktoken@1.0.21. Proves:
 *  (1) each static prompt block's exact token size == the controlling doc §11;
 *  (2) every complete provider input (block + delimiter + envelope JSON) <= 1600;
 *  (3) the Appendix-H worked-example outputs are within cap (600, Location 580);
 *  (4) the cap-saturated worst case at zh density (1 token/char) is within cap —
 *      Location realistic-maximal <= 580; semantic-key schema max <= 700 (see window cap note).
 */
import { getEncoding } from "js-tiktoken";
import { DICE_V05_BLOCK, buildProviderInput, CAPS } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope, buildTimingEnvelope, buildLevel1Envelope, buildLocationResolution } from "./dice-v0-5-presentation.ts";

const enc = getEncoding("o200k_base");
const n = (s: string) => enc.encode(s).length;
function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }

/* (1) Block token sizes — exact match to §11 (Stage-1 322, Judgment 464, Timing 437, Location 577, Level-1 311). */
const BLOCK_TOKENS = { stage1: 322, judgment: 464, timing: 437, location: 577, level1: 311 } as const;
for (const k of Object.keys(BLOCK_TOKENS) as (keyof typeof BLOCK_TOKENS)[]) {
  ok(n(DICE_V05_BLOCK[k]) === BLOCK_TOKENS[k], `block ${k} == ${BLOCK_TOKENS[k]} tokens (got ${n(DICE_V05_BLOCK[k])})`);
}

/* (2) Complete input <= 1600 for representative Appendix-H envelopes, both languages. */
for (const L of ["en", "zh-Hant"] as const) {
  const inputs: Array<[string, string, unknown]> = [
    ["judgment", DICE_V05_BLOCK.judgment, buildJudgmentEnvelope(L, "Should I take the working-holiday offer this year?", "jupiter", "sagittarius", 1)],
    ["timing", DICE_V05_BLOCK.timing, buildTimingEnvelope(L, "How soon will my application be approved?", "pluto", "sagittarius", 1)],
    ["level1", DICE_V05_BLOCK.level1, buildLevel1Envelope("person", L, "What kind of person is my new manager?", "saturn", "libra", 10)],
    ["location", DICE_V05_BLOCK.location, buildLocationResolution(L, "moon", "leo", 4).envelope],
  ];
  for (const [m, b, env] of inputs) {
    const t = n(buildProviderInput(b, env));
    ok(t <= 1600, `complete input ${m}/${L} = ${t} <= 1600`);
  }
}

/* (3) Appendix-H worked-example provider outputs within cap. */
const H_OUTPUTS: Array<[string, number, string]> = [
  ["judgment/zh (H.2)", 600, `{"status":"ok","planet_prose":"木星是大吉星，落在自己守護的射手座，力量最強；大方、遠見及資源優勢能充分發揮。","house_prose":"第一宮為大吉、排行第一，環境非常有利，而且事情較掌握在自己手中。","synthesis":"行星與宮位兩邊都屬有利：最強的大吉星配上最吉的宮位，支持這條路；兩邊仍分開判斷，不合併成單一總分。","watch_out":"木星的擴張傾向可能令人過度樂觀，即使環境有利，也要控制承諾和開支。","suggested_followups":["去working holiday前我應先準備甚麼？","如果去，我的財務會怎樣發展？"]}`],
  ["timing/en (H.4)", 600, `{"status":"ok","timing_summary":"The underlying process is extremely slow, but the immediate environment accelerates it, bringing the overall pace into the medium range.","synthesis":"Pluto supplies the extremely slow inherent pace. House 1 supplies a fast, immediate environment and greater ability to move the matter forward. That environment accelerates the process without erasing Pluto's natural slowness, so the fixed result is medium rather than fast or slow. The supplied neutral dignity affects smoothness only and does not change the band.","watch_out":null}`],
  ["level1/en (H.7)", 600, `{"status":"ok","synthesis":"This manager combines Saturn's seriousness, responsibility and long-term structure with Libra's cooperative, balanced manner, expressed through House 10 career and status: orderly, substantial and attentive to working relationships.","watch_out":"They are likely to value procedure and fairness, so bypassing the process may create resistance.","practical_step":"Learn the standards and goals they prioritise, then present your suggestion in a structured way."}`],
];
for (const [id, cap, json] of H_OUTPUTS) {
  const t = n(json);
  ok(t <= cap, `Appendix-H output ${id} = ${t} <= ${cap}`);
}

/* (4) Cap-saturated worst case at zh density (1 token/char) — the binding bound. */
const fill = (len: number) => "字".repeat(len);
function saturate(mode: "judgment" | "timing" | "level1" | "location"): Record<string, unknown> {
  const c: any = (CAPS as any)[mode]["zh-Hant"];
  if (mode === "judgment") return { status: "ok", planet_prose: fill(c.planet), house_prose: fill(c.house), synthesis: fill(c.syn), watch_out: fill(c.watch), suggested_followups: [fill(c.follow), fill(c.follow), fill(c.follow)] };
  if (mode === "timing") return { status: "ok", timing_summary: fill(c.ts), synthesis: fill(c.syn), watch_out: fill(c.watch) };
  if (mode === "level1") return { status: "ok", synthesis: fill(c.syn), watch_out: fill(c.watch), practical_step: fill(c.pract) };
  // Worst case uses long realistic semantic evidence keys (not short "pt"/"e1").
  const cand = (r: number) => ({ rank: r, place: fill(c.place), evidence: { p: ["p_near_water_domestic", "p_caregiving_service"], h: ["h_deliberately_hidden", "h_institution_isolated"], e: ["e_mountain_high_ground", "e_pool_pond_river"] } });
  return { status: "ok", most_likely_area: fill(c.area), synthesis: fill(c.syn), location_candidates: [cand(1), cand(2), cand(3), cand(4)], extension: { candidate_rank: 1, src: "p_near_water_domestic", relationship: fill(c.ext) }, search_order: [1, 2, 3, 4], watch_out: fill(c.watch), practical_step: fill(c.pract) };
}
// Location uses stable SEMANTIC evidence ids (reviewer item 3), which enlarge echoed keys.
// The schema-permitted PATHOLOGICAL max (4 candidates × 2 long keys in all 3 arrays + every
// field at cap) is ~658 zh, bounded by the raised 700 backstop; a REALISTIC maximal answer
// (each candidate cites 1 key, all prose at cap) stays <= 580.
const OUT_CAP = { judgment: 600, timing: 600, level1: 600, location: 700 } as const;
for (const m of ["judgment", "timing", "level1", "location"] as const) {
  const t = n(JSON.stringify(saturate(m)));
  ok(t <= OUT_CAP[m], `cap-saturated (schema max) ${m}/zh = ${t} <= ${OUT_CAP[m]}`);
}
// Realistic maximal Location answer (1 evidence key per candidate) stays within the old 580 target.
const cReal: any = (CAPS as any).location["zh-Hant"];
const candReal = (r: number) => ({ rank: r, place: fill(cReal.place), evidence: { p: ["p_near_water_domestic"], h: [], e: [] } });
const realLoc = { status: "ok", most_likely_area: fill(cReal.area), synthesis: fill(cReal.syn), location_candidates: [candReal(1), candReal(2), candReal(3), candReal(4)], extension: null, search_order: [1, 2, 3, 4], watch_out: fill(cReal.watch), practical_step: fill(cReal.pract) };
ok(n(JSON.stringify(realLoc)) <= 580, `realistic-maximal location/zh = ${n(JSON.stringify(realLoc))} <= 580`);

console.log("dice-v0-5 tokenizer fixtures passed");
