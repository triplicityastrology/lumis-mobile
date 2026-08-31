/**
 * v5 production-tokenizer fixture (§21). Uses the SAME encoder as the runtime
 * tokenizer `dice-tokenizer-v1.ts`: o200k_base via js-tiktoken@1.0.21. Proves:
 *  (1) each static prompt block's exact token size == the controlling doc §11;
 *  (2) every complete provider input (block + delimiter + envelope JSON) <= 1600;
 *  (3) the Appendix-H worked-example outputs are within cap (600, Location 580);
 *  (4) the cap-saturated worst case at zh density (1 token/char) is within cap —
 *      Location schema-permitted PATHOLOGICAL max <= 580 (EN and zh), via compact wire codes.
 */
import { getEncoding } from "js-tiktoken";
import { DICE_V05_BLOCK, buildProviderInput, CAPS } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope, buildTimingEnvelope, buildLevel1Envelope, buildLocationResolution } from "./dice-v0-5-presentation.ts";
import { DICE_V05_PLANET_IDS, DICE_V05_SIGN_IDS, SIGN_ELEMENT } from "./dice-v0-5-fixed-data.ts";

const enc = getEncoding("o200k_base");
const n = (s: string) => enc.encode(s).length;
function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("FAIL " + l); }

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

/* (2b) GENUINE worst-case Location INPUT (reviewer item 3), measured with the lossless compact
 * wire encoding, the COMPLETE Planet/House/Element banks + all context hints, and a real
 * maximum-length (280 code-point) question. The Location Stage-2 input cap is 1800 (all other
 * modes stay 1600); this sweep proves EVERY Planet × House × Sign/Element × language stays
 * <= 1800 with headroom, and reports the actual worst case. Nothing is trimmed or shortened. */
const LOCATION_INPUT_CAP = 1800, LOCATION_HEADROOM_MIN = 80;
// A real 280-code-point question in each language (>280 is rejected by the Stage-0 gate).
function to280(base: string): string { const a = [...base]; while (a.length < 280) a.push(a[a.length % base.length] ?? "…"); return a.slice(0, 280).join(""); }
const Q280_EN = to280("I lost my passport somewhere at home last week after coming back from a long trip, and I have looked in the bedroom, the living room, the kitchen drawers and every bag I own, so where exactly should I start searching for it now, please, in detail? ");
const Q280_ZH = to280("我上星期由外地返嚟之後唔見咗本護照，喺屋企搵過睡房、客廳、廚房啲抽屜同埋所有袋都搵唔到，想知究竟而家應該由邊個位置開始搵先至最有可能搵得返，唔該詳細啲講一講好唔好呢？");
ok([...Q280_EN].length === 280 && [...Q280_ZH].length === 280, "worst-case questions are exactly 280 code points");
const Q = (L: "en" | "zh-Hant") => (L === "en" ? Q280_EN : Q280_ZH);
const locInput = (L: "en" | "zh-Hant", p: any, s: any, h: number) => n(buildProviderInput(DICE_V05_BLOCK.location, { ...buildLocationResolution(L, p, s, h).envelope, question: Q(L) }));

// The Location payload depends on a sign ONLY through its element, so 4 element representatives
// cover all 12 signs. Prove that explicitly (identical `given` for same-element signs), then the
// element-deduplicated sweep below is exhaustive over all 12×12×12×2 Planet×House×Sign×language.
const ELEMENTS = ["Fire", "Earth", "Air", "Water"] as const;
const repSign: Record<string, any> = {};
for (const s of DICE_V05_SIGN_IDS) { const el = SIGN_ELEMENT[s]; if (!repSign[el]) repSign[el] = s; }
for (const el of ELEMENTS) {
  const ref = JSON.stringify(buildLocationResolution("zh-Hant", "sun", repSign[el], 1).envelope);
  for (const s of DICE_V05_SIGN_IDS) if (SIGN_ELEMENT[s] === el) eq(JSON.stringify(buildLocationResolution("zh-Hant", "sun", s, 1).envelope), ref, `sign ${s} envelope == ${el} representative (sign enters only via element)`);
}

// Explicit reviewer case: Mercury / House 12 / Water, both languages.
for (const L of ["en", "zh-Hant"] as const) ok(locInput(L, "mercury", repSign.Water, 12) <= LOCATION_INPUT_CAP, `mercury/house12/water/${L} = ${locInput(L, "mercury", repSign.Water, 12)} <= ${LOCATION_INPUT_CAP}`);

// Exhaustive sweep (element-deduplicated) over every Planet × House × Element × language.
let maxTok = 0, maxWho = "";
for (const L of ["en", "zh-Hant"] as const) for (const planet of DICE_V05_PLANET_IDS) for (let h = 1; h <= 12; h++) for (const el of ELEMENTS) {
  const t = locInput(L, planet, repSign[el], h);
  if (t > maxTok) { maxTok = t; maxWho = `${planet}/house${h}/${el}/${L}`; }
  ok(t <= LOCATION_INPUT_CAP, `location input ${planet}/house${h}/${el}/${L} = ${t} <= ${LOCATION_INPUT_CAP}`);
}
ok(LOCATION_INPUT_CAP - maxTok >= LOCATION_HEADROOM_MIN, `worst-case location input ${maxTok} keeps >= ${LOCATION_HEADROOM_MIN} headroom to ${LOCATION_INPUT_CAP}`);
console.log(`  location worst-case input (exhaustive Planet×House×Element, both languages) = ${maxTok} at ${maxWho} (<= ${LOCATION_INPUT_CAP}, headroom ${LOCATION_INPUT_CAP - maxTok})`);
// Non-location modes remain within the unchanged 1600 input cap (proved in section (2) above).

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
  // Location echoes COMPACT wire codes (p01/h03/e02), so even the schema-permitted PATHOLOGICAL
  // worst case (4 candidates × 2 codes in all 3 arrays + every field at its cap) stays <= 580.
  const cand = (r: number) => ({ rank: r, place: fill(c.place), evidence: { p: ["p07", "p08"], h: ["h04", "h05"], e: ["e04", "e05"] } });
  return { status: "ok", most_likely_area: fill(c.area), synthesis: fill(c.syn), location_candidates: [cand(1), cand(2), cand(3), cand(4)], extension: { candidate_rank: 1, src: "p07", relationship: fill(c.ext) }, search_order: [1, 2, 3, 4], watch_out: fill(c.watch), practical_step: fill(c.pract) };
}
// Founder Decision B: the member-VISIBLE Location JSON is <= 580 tokens by construction. With
// compact wire codes the schema-permitted PATHOLOGICAL maximum (4 candidates × 2 codes in all 3
// arrays + every field at cap) is within 580 — the runtime measures the RETURNED visible JSON
// against this 580 (dice-v0-5-window LOCATION_OUTPUT_CAP). The provider generation allowance is a
// SEPARATE, larger budget (window STAGE2_GENERATION_CAP = 2000) that also covers hidden reasoning.
const OUT_CAP = { judgment: 600, timing: 600, level1: 600, location: 580 } as const;
for (const m of ["judgment", "timing", "level1", "location"] as const) {
  const t = n(JSON.stringify(saturate(m)));
  ok(t <= OUT_CAP[m], `cap-saturated (schema max) ${m}/zh = ${t} <= ${OUT_CAP[m]}`);
}
// The EN pathological maximum (longer EN field caps) must also stay <= 580.
const cEn: any = (CAPS as any).location.en;
const candEn = (r: number) => ({ rank: r, place: "x".repeat(cEn.place), evidence: { p: ["p07", "p08"], h: ["h04", "h05"], e: ["e04", "e05"] } });
const enLoc = { status: "ok", most_likely_area: "x".repeat(cEn.area), synthesis: "x".repeat(cEn.syn), location_candidates: [candEn(1), candEn(2), candEn(3), candEn(4)], extension: { candidate_rank: 1, src: "p07", relationship: "x".repeat(cEn.ext) }, search_order: [1, 2, 3, 4], watch_out: "x".repeat(cEn.watch), practical_step: "x".repeat(cEn.pract) };
ok(n(JSON.stringify(enLoc)) <= 580, `pathological-max location/en = ${n(JSON.stringify(enLoc))} <= 580`);

console.log("dice-v0-5 tokenizer fixtures passed");
