/** Workbook QA fixtures (node-runnable; MOCK adapter, no network).
 * Maps the Founder workbook tab "Prompt v3 two-stage engine" rows to deterministic Stage-3
 * customer-language checks on representative canonical Stage-2 inputs. Verifies the specific
 * defect each row reported is now caught (fragments, ranks, timing formulas, blended grades),
 * that the deterministic fallback is clean+complete, that Stage 3 never runs for a bundled
 * question, and records the exact public question_mode for every completed row. Location rows
 * (12/12.1/12.2) exercise Stage-3 copy on a MOCKED canonical Location result only; real
 * end-to-end Location stays BLOCKED_BY_SEPARATE_WHERE_BASE. No raw question/reading is emitted. */
import {
  prohibitedLanguageCheck, completenessCheck, preservationCheck, deterministicCustomerCopy,
  parseCustomerCopy, DICE_V05_CUSTOMER_COPY_SCHEMA, type DiceV05CustomerCopy,
} from "../_shared/dice-v0-5-customer-copy.ts";
import { executeDiceV05FreeTextCaseWithCopy } from "../_shared/dice-v0-5-window-with-copy.ts";
import { parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter } from "../_shared/dice-v0-5-window.ts";
import type { DiceV05Mode } from "../_shared/dice-v0-5-interpretation-contract.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

const base = (language: "en" | "zh-Hant", question_mode: DiceV05Mode, over: Record<string, unknown>) => Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language, question_mode,
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null,
  location_extension: null, location_search_order: null, synthesis: null, timing_summary: null,
  watch_out: null, practical_step: null, suggested_followups: [], ...over,
});

// Canonical results. EXACT workbook rows carry the row's actual landing in a comment; GENERIC
// illustrations of a defect class are labelled generic and do NOT count as workbook acceptance (C07).
const CANON: Record<string, any> = {
  level1_en: base("en", "thing_or_situation", { synthesis: "This role suits steady, detail-focused work where you can build expertise over time.", watch_out: "A chaotic, fast-changing setting may scatter your focus.", practical_step: "Pick one stable direction and build a track record before switching." }),
  person_en: base("en", "person", { synthesis: "This person is careful and practical, and builds trust slowly through dependable actions.", watch_out: "They may seem reserved until they feel settled.", practical_step: "Give them clear, concrete information rather than pressure." }),
  // GENERIC relationship-judgment example (Mars-style). NOT the T5 working-holiday row.
  judgment_zh: base("zh-Hant", "judgment", { planet_side: { fortune: "minor_malefic", fortune_zh: "小凶星", dignity: "detriment", dignity_zh: "陷", strength: "weak", constructive_traits: "主動", difficult_traits: "急躁", dignity_emphasis: "difficult", prose: "火星這一面較急，太強硬容易帶來磨擦。" }, house_side: { fortune: "fortune", fortune_zh: "吉", rank: 7, prose: "外在條件對這件事較為有利。" }, synthesis: "環境有利，但你的處理方式是關鍵。", watch_out: "跟進時不要催逼對方。", suggested_followups: ["我可以點樣調整？"] }),
  // T5 EXACT row — Jupiter / Sagittarius / House 1, question 我應唔應該去Working holiday？ (judgment).
  judgment_t5_zh: base("zh-Hant", "judgment", { planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "domicile", dignity_zh: "廟", strength: "strong", constructive_traits: "樂觀、進取", difficult_traits: "過度理想", dignity_emphasis: "constructive", prose: "木星這一面強而有力，鼓勵你向外拓展、把握成長機會。" }, house_side: { fortune: "fortune", fortune_zh: "吉", rank: 1, prose: "第一宮把主動權放在你自己手上，行動由你主導。" }, synthesis: "整體方向支持你踏出這一步，但仍要把計劃保持務實。", watch_out: "不要讓樂觀蓋過實際準備。", suggested_followups: ["我應該先準備甚麼？"] }),
  // T7 EXACT row — Pluto / Sagittarius / House 1 = MEDIUM (very slow inherent pace, accelerating House 1).
  timing_t7_zh: base("zh-Hant", "timing", { synthesis: "冥王星本身的節奏非常慢，但第一宮把事情放到你自己手上，會推動並加快整體進程，所以最終落在中等。", timing_summary: "進度屬於中等，不會即時有結果，但亦不會長期停滯。", watch_out: null }),
  // T8 EXACT row — Moon / Sagittarius / House 1 = FAST (DISTINCT from T7; never reuse T7's medium).
  timing_t8_zh: base("zh-Hant", "timing", { synthesis: "月亮本身節奏很快，第一宮亦讓事情由你主導，兩者相加令整體進展相對快。", timing_summary: "進度屬於偏快，通常會較早見到變化。", watch_out: null }),
  location_en: base("en", "location", { most_likely_area: "Most likely a quiet storage spot at home.", location_candidates: [{ rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.bedroom"], house_ids: [], element_ids: [] } }, { rank: 2, place: "the kitchen", evidence: { planet_ids: [], house_ids: ["house.4.related.kitchen"], element_ids: [] } }], location_search_order: [1, 2], synthesis: "The Moon points to a private, domestic setting, so begin indoors.", watch_out: "Do not assume it is permanently lost.", practical_step: "Start with the bedroom, then the kitchen." }),
};

// A prohibited/fragment copy generator for the "defect must be caught" rows (status "ok" object).
const copy = (language: "en" | "zh-Hant", mode: DiceV05Mode, o: Partial<DiceV05CustomerCopy>): DiceV05CustomerCopy => ({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", language, question_mode: mode, headline: "H.", reading: "R.", watch_out: null, practical_step: null, suggested_followups: mode === "judgment" ? ["Q?"] : [], ...o,
});

async function main() {
  const recorded: string[] = [];
  const rec = (id: string, mode: DiceV05Mode) => recorded.push(`${id}:${mode}`);
  // A row whose exact workbook mode/landing is not reliably reproduced here is recorded as
  // generic — a defect-class illustration, NOT a claim of exact workbook acceptance (C07).
  const recGeneric = (id: string) => recorded.push(`${id}:generic`);

  // Rows whose deterministic fallback (the safety net) must itself be clean + complete.
  for (const [id, c] of [["T1", CANON.level1_en], ["T3", CANON.level1_en], ["T11", CANON.person_en], ["T8.2", CANON.judgment_zh], ["T13", CANON.judgment_zh]] as const) {
    const fb = deterministicCustomerCopy(c);
    eq(parseCustomerCopy(c.question_mode, c.language, JSON.stringify(fb)).kind, "ok", `${id} fallback valid`);
    eq(completenessCheck(fb), "OK", `${id} fallback complete sentences`);
    eq(prohibitedLanguageCheck(fb), "OK", `${id} fallback no prohibited term`);
    rec(id, c.question_mode);
  }
  // T8.2 (Mars judgment): both axes retained in the fallback reading (planet + house prose present).
  const j = deterministicCustomerCopy(CANON.judgment_zh);
  ok(j.reading.includes("火星") && j.reading.includes("外在條件"), "T8.2 fallback keeps BOTH judgment factors (planet + house)");

  // T2: fragment tails must be rejected (defect-class check). The examples file previously
  // attributed T2 to thing_or_situation while this fixture recorded "reason"; the exact workbook
  // T2 row/mode is not reliably reproduced here, so T2 is recorded as GENERIC and both fragment
  // cases below are illustrative (they do not assert an exact workbook mode). Also verify the
  // fragment is rejected WITH a trailing period (C01 normalization).
  ok(completenessCheck(copy("en", "person", { headline: "This is steady.", reading: "Beware of overex" })) !== "OK", "T2(generic) 'Beware of overex' rejected");
  ok(completenessCheck(copy("en", "person", { headline: "Steady.", reading: "Beware of overex." })) !== "OK", "T2(generic) 'Beware of overex.' with period still rejected (C01)");
  ok(completenessCheck(copy("en", "person", { headline: "Ready.", reading: "enforcing brief," })) !== "OK", "T2(generic) 'enforcing brief,' dangling comma rejected");
  recGeneric("T2");
  // T4 (Venus judgment): abrupt ending after 'carefree play' (no terminal punctuation) rejected.
  ok(completenessCheck(copy("en", "judgment", { headline: "Weigh both sides.", reading: "It leans supportive with room for carefree play", watch_out: "Stay grounded." })) !== "OK", "T4 abrupt 'carefree play' ending rejected");
  rec("T4", "judgment");
  // T4.1 / T10 relationship judgment: raw House rank / 'rank 7' must not appear.
  ok(prohibitedLanguageCheck(copy("en", "judgment", { headline: "It can grow.", reading: "This sits on rank 7 of the houses.", watch_out: "Communicate openly." })) !== "OK", "T4.1/T10 raw 'rank 7' rejected");
  rec("T4.1", "judgment"); rec("T10", "judgment");
  // T5 EXACT row — Jupiter / Sagittarius / House 1, 我應唔應該去Working holiday？ (judgment). 排名第一
  // must not appear (defect-class), and the row's own deterministic fallback keeps BOTH Jupiter and
  // House-1 factors and is clean/complete. This uses the T5 canonical, NOT a reused Mars sample.
  ok(prohibitedLanguageCheck(copy("zh-Hant", "judgment", { headline: "方向有利。", reading: "這是排名第一的結果。", watch_out: "做好準備。" })) !== "OK", "T5 排名第一 rejected");
  const t5 = deterministicCustomerCopy(CANON.judgment_t5_zh);
  eq(completenessCheck(t5), "OK", "T5 fallback complete");
  eq(prohibitedLanguageCheck(t5), "OK", "T5 fallback no prohibited term (no 大吉/廟/rank leak)");
  ok(t5.reading.includes("木星") && t5.reading.includes("第一宮"), "T5 fallback keeps both Jupiter + House-1 factors");
  rec("T5", "judgment");
  // T8.1 Venus judgment: raw dignity classification 大吉 must not appear.
  ok(prohibitedLanguageCheck(copy("zh-Hant", "judgment", { headline: "大吉。", reading: "整體大吉。", watch_out: "留意。" })) !== "OK", "T8.1 大吉 rejected");
  rec("T8.1", "judgment");
  // T7 EXACT row — Pluto / Sagittarius / House 1 = MEDIUM. Keep the band; reject a speed formula.
  ok(prohibitedLanguageCheck(copy("en", "timing", { headline: "The pace is medium.", reading: "This is planet_speed x house_speed overall." })) !== "OK", "T7 speed formula rejected");
  const t7 = deterministicCustomerCopy(CANON.timing_t7_zh);
  ok(t7.headline.includes("中等"), "T7 fallback preserves the MEDIUM band in the headline");
  ok(t7.reading.includes("非常慢") && t7.reading.includes("加快"), "T7 keeps the very-slow inherent pace + accelerating House environment");
  rec("T7", "timing");
  // T8 EXACT row — Moon / Sagittarius / House 1 = FAST (distinct from T7). Reject the speed formula.
  ok(prohibitedLanguageCheck(copy("en", "timing", { headline: "It is relatively quick.", reading: "fastest x fast -> fast is the result." })) !== "OK", "T8 'fastest x fast -> fast' rejected");
  const t8 = deterministicCustomerCopy(CANON.timing_t8_zh);
  ok(t8.headline.includes("偏快"), "T8 fallback preserves the FAST band in the headline");
  // T7 and T8 must NOT share the same timing result (§11 check 4).
  ok(t7.headline !== t8.headline && (CANON.timing_t7_zh.synthesis !== CANON.timing_t8_zh.synthesis), "T7 (medium) and T8 (fast) have DISTINCT canonical sources and outputs");
  rec("T8", "timing");
  // T9 job type: the copy stays thing_or_situation and is not converted to a judgment answer.
  const t9 = deterministicCustomerCopy(CANON.level1_en);
  eq(t9.question_mode, "thing_or_situation", "T9 copy stays thing_or_situation");
  eq(preservationCheck(t9, CANON.level1_en), "OK", "T9 copy preserves mode/language");
  rec("T9", "thing_or_situation");

  // T6 bundled: Stage 3 must NOT run. The adapter throws if invoked, proving zero provider calls.
  const bundledReq = parseDiceV05FreeTextRequest({ question: "我個application會唔會批？幾時會批？", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" });
  ok(bundledReq, "T6 bundled request parses");
  const throwAdapter: DiceV05ProviderAdapter = { invoke: async () => { throw new Error("provider must not be called for a bundled question"); } };
  const bundled = await executeDiceV05FreeTextCaseWithCopy(bundledReq!, () => throwAdapter, () => 1000);
  eq(bundled.kind, "bundled", "T6 stays bundled at Stage 0");
  ok(!("customer_copy" in (bundled as any)), "T6 no customer copy (Stage 3 did not run)");
  eq((bundled as any).provider_calls, 0, "T6 zero provider calls");
  rec("T6", "bundled" as DiceV05Mode);

  // T12 / T12.1 / T12.2 Location — Stage-3 copy quality on a MOCKED canonical Location result only.
  const locFb = deterministicCustomerCopy(CANON.location_en);
  eq(completenessCheck(locFb), "OK", "T12* location fallback complete");
  eq(prohibitedLanguageCheck(locFb), "OK", "T12* location fallback no prohibited term");
  eq(preservationCheck(locFb, CANON.location_en), "OK", "T12* location preserves area/mode");
  for (const id of ["T12", "T12.1", "T12.2"]) { rec(id, "location"); console.log(`${id}: Stage-3 Location copy checked on MOCK canonical — real end-to-end BLOCKED_BY_SEPARATE_WHERE_BASE`); }

  console.log("question_mode recorded per row:", recorded.join(" "));
  console.log("dice-v0-5 workbook customer-copy fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
