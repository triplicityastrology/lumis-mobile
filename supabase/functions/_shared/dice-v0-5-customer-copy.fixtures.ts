/** Stage-3 customer-language editor — unit fixtures (node-runnable; MOCK adapter, no network).
 * Verifies the customer-copy schema, Stage-2→Stage-3 mapping, strict parse, prohibited-language,
 * completeness, meaning-preservation, execution (stage3 vs deterministic fallback) and the
 * production-tokenizer max-envelope measurement. No raw question/provider body is emitted. */
import {
  DICE_V05_CUSTOMER_COPY_SCHEMA, buildCustomerCopySchema, buildCustomerCopyInput, parseCustomerCopy,
  prohibitedLanguageCheck, completenessCheck, preservationCheck, deterministicCustomerCopy,
  executeDiceV05CustomerCopy, customerCopySchemaName, COPY_CAPS, CUSTOMER_COPY_OUTPUT_CAP,
  type DiceV05CustomerCopy,
} from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult, type DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";
import type { DiceV05ProviderAdapter, DiceV05ProviderResult } from "./dice-v0-5-window.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

/* ---- representative, schema-valid canonical Stage-2 finals (§12.4) ---- */
const judgmentCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "judgment",
  planet_side: { fortune: "minor_malefic", fortune_zh: "小凶星", dignity: "detriment", dignity_zh: "陷", strength: "weak",
    constructive_traits: "主動、果斷", difficult_traits: "急躁、衝動", dignity_emphasis: "difficult",
    prose: "火星這一面較為困難：處理方式若太急或太強硬，容易帶來磨擦。" },
  house_side: { fortune: "fortune", fortune_zh: "吉", rank: 4, prose: "第七宮的外在條件對這件事較為有利，對方有合作空間。" },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "整體而言，外在環境有利，但你這邊的處理方式會明顯影響結果。", timing_summary: null,
  watch_out: "留意跟進時的語氣，不要催逼對方。", practical_step: null, suggested_followups: ["我可以點樣改善溝通？"],
});
const timingCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "timing",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "事情本身需要較長時間處理，不過目前的環境有助推動進度，所以整體會比原本的慢節奏快一些。", timing_summary: "進度屬於中等，不會即時有結果，但亦不會長期停滯。",
  watch_out: null, practical_step: null, suggested_followups: [],
});
const locationCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location",
  planet_side: null, house_side: null,
  most_likely_area: "Most likely a quiet storage spot at home.",
  location_candidates: [
    { rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.bedroom"], house_ids: [], element_ids: [] } },
    { rank: 2, place: "the kitchen", evidence: { planet_ids: [], house_ids: ["house.4.related.kitchen"], element_ids: [] } },
  ],
  location_extension: null, location_search_order: [1, 2],
  synthesis: "The Moon points to a private, domestic setting, so begin indoors where daily items are kept.",
  timing_summary: null, watch_out: "Do not assume it is permanently lost.", practical_step: "Start with the bedroom, then check the kitchen.", suggested_followups: [],
});
const personCanonical = Object.freeze({
  schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "person",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "This person is careful and practical, and tends to build trust slowly through consistent, dependable actions.",
  timing_summary: null, watch_out: "They may seem reserved before they feel settled.", practical_step: "Give them clear, concrete information rather than pressure.", suggested_followups: [],
});
for (const [n, c] of [["judgment", judgmentCanonical], ["timing", timingCanonical], ["location", locationCanonical], ["person", personCanonical]] as const) {
  eq(validateDiceV05FinalResult(c as any), "OK", `canonical ${n} is a valid §12.4 final`);
}

async function main() {
/* ---- schema shape ---- */
const jSchema: any = buildCustomerCopySchema("judgment", "zh-Hant");
eq(jSchema.additionalProperties, false, "copy schema closed");
eq(jSchema.properties.practical_step, { type: "null" }, "judgment copy practical_step is null-only");
eq(jSchema.properties.suggested_followups.minItems, 1, "judgment copy requires >=1 followup");
const tSchema: any = buildCustomerCopySchema("timing", "en");
eq(tSchema.properties.practical_step, { type: "null" }, "timing copy practical_step null-only");
eq(tSchema.properties.suggested_followups.maxItems, 0, "timing copy has no followups");
const lSchema: any = buildCustomerCopySchema("location", "en");
ok(lSchema.properties.practical_step.type === "string", "location copy requires practical_step");
eq(customerCopySchemaName("thing_or_situation"), "lumis_dice_customer_copy_level1_v1", "level1 family schema name");

/* ---- input mapping keeps only text; both judgment axes carried ---- */
const jInput = buildCustomerCopyInput(judgmentCanonical as any, "我個application會唔會批？");
eq(jInput.locked_conclusion.required_meanings.length, 2, "judgment maps both axes as required meanings");
ok(jInput.locked_conclusion.forbidden_additions.some((f) => /averaged|blended/.test(f)), "judgment forbids blended grade");
ok(!JSON.stringify(jInput).includes("dignity_emphasis") && !JSON.stringify(jInput).includes('"rank"'), "input carries no rank/dignity_emphasis keys as facts");
const lInput = buildCustomerCopyInput(locationCanonical as any, "where is it?");
eq(lInput.source_sections.location_places, ["the bedroom", "the kitchen"], "location input carries ordered candidate places");

/* ---- prohibited-language + completeness catch the Founder-reported leaks ---- */
const badRank: DiceV05CustomerCopy = { schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "zh-Hant", question_mode: "judgment", headline: "大吉，排名第一。", reading: "第三順位又唔係好清楚。", watch_out: "留意。", practical_step: null, suggested_followups: ["問題？"] };
ok(prohibitedLanguageCheck(badRank) !== "OK", "prohibited: rank/排名/順位/大吉 rejected");
const badFormula: DiceV05CustomerCopy = { schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "timing", headline: "It is medium.", reading: "This is planet_speed x house_speed = fastest x fast -> fast overall.", watch_out: null, practical_step: null, suggested_followups: [] };
ok(prohibitedLanguageCheck(badFormula) !== "OK", "prohibited: speed formula rejected");
const fragment: DiceV05CustomerCopy = { schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: "This person is steady.", reading: "They tend to be careful and", watch_out: null, practical_step: null, suggested_followups: [] };
ok(completenessCheck(fragment) !== "OK", "completeness: dangling 'and' rejected");
const knownFrag: DiceV05CustomerCopy = { ...fragment, reading: "Beware of overex" };
ok(completenessCheck(knownFrag) !== "OK", "completeness: known workbook fragment tail rejected");
const cleanPerson: DiceV05CustomerCopy = { schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: "This person is steady and practical.", reading: "They build trust slowly and prefer clear, concrete information.", watch_out: null, practical_step: "Give them time to settle in.", suggested_followups: [] };
eq(prohibitedLanguageCheck(cleanPerson), "OK", "clean copy passes prohibited check");
eq(completenessCheck(cleanPerson), "OK", "clean copy passes completeness");

/* ---- deterministic fallback is itself always clean + complete for every mode ---- */
for (const [n, c] of [["judgment", judgmentCanonical], ["timing", timingCanonical], ["location", locationCanonical], ["person", personCanonical]] as const) {
  const fb = deterministicCustomerCopy(c as any);
  eq(parseCustomerCopy(c.question_mode as DiceV05Mode, c.language as any, JSON.stringify(fb)).kind, "ok", `fallback ${n} satisfies its own contract`);
  eq(prohibitedLanguageCheck(fb), "OK", `fallback ${n} has no prohibited term`);
  eq(completenessCheck(fb), "OK", `fallback ${n} has no fragment`);
  eq(preservationCheck(fb, c as any), "OK", `fallback ${n} preserves mode/language`);
}

/* ---- execution: mock adapter returning valid copy → source stage3 ---- */
const copyAdapter = (content: string, kind: DiceV05ProviderResult["kind"] = "success"): DiceV05ProviderAdapter => ({
  invoke: async () => (kind === "success" ? { kind: "success", content } : { kind } as DiceV05ProviderResult),
});
const goodJudgmentCopy = JSON.stringify({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "zh-Hant", question_mode: "judgment",
  headline: "外在條件較有利，但你的處理方式是關鍵。", reading: "對方有合作空間，環境對你有利。不過火星這一面較急，太強硬或會帶來磨擦，兩者需要分開理解。",
  watch_out: "跟進時保持主動，但不要催逼對方。", practical_step: null, suggested_followups: ["我可以點樣調整語氣？"],
});
const r1 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "我個application會唔會批？", copyAdapter(goodJudgmentCopy), { now: () => 1000 });
eq(r1.source, "stage3", "valid judgment copy accepted from Stage 3");
eq(r1.provider_calls, 1, "one Stage-3 provider call");
eq(r1.copy.practical_step, null, "judgment copy keeps practical_step null");

/* ---- execution: prohibited term in copy → deterministic fallback (no throw) ---- */
const rankyCopy = JSON.stringify({ schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "zh-Hant", question_mode: "judgment", headline: "排名第一，大吉。", reading: "第三順位。", watch_out: "留意。", practical_step: null, suggested_followups: ["問題？"] });
const r2 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", copyAdapter(rankyCopy), { now: () => 1000 });
eq(r2.source, "fallback", "prohibited-term copy falls back deterministically");
ok(r2.failure_code && r2.failure_code.startsWith("DICE_COPY_PROHIBITED"), "fallback records prohibited-term failure code");
eq(prohibitedLanguageCheck(r2.copy), "OK", "fallback copy itself is clean");

/* ---- execution: provider network error → fallback; unpresentable → fallback ---- */
const r3 = await executeDiceV05CustomerCopy(timingCanonical as any, "幾時批？", copyAdapter("", "network"), { now: () => 1000 });
eq(r3.source, "fallback", "provider failure falls back");
const r4 = await executeDiceV05CustomerCopy(personCanonical as any, "what kind of person?", copyAdapter(JSON.stringify({ status: "unpresentable" })), { now: () => 1000 });
eq(r4.source, "fallback", "explicit unpresentable falls back");
eq(r4.failure_code, "DICE_COPY_UNPRESENTABLE", "unpresentable code recorded");

/* ---- production-tokenizer max-envelope measurement (report + assert within cap) ---- */
const maxEnvelope = (mode: DiceV05Mode, language: "en" | "zh-Hant") => {
  const c = COPY_CAPS; const fam = mode === "judgment" || mode === "timing" || mode === "location" ? mode : "level1";
  const fill = (n: number) => (language === "en" ? "a" : "字").repeat(n);
  const body: any = { schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language, question_mode: mode,
    headline: fill(c.headline[language]), reading: fill(c.reading[language]),
    watch_out: fam === "timing" || fam === "level1" ? fill(c.watch_out[language]) : fill(c.watch_out[language]),
    practical_step: fam === "judgment" || fam === "timing" ? null : fill(c.practical_step[language]),
    suggested_followups: fam === "judgment" ? [fill(c.followup[language]), fill(c.followup[language]), fill(c.followup[language])] : [] };
  return JSON.stringify(body);
};
for (const mode of ["judgment", "timing", "location", "person"] as DiceV05Mode[]) {
  for (const language of ["en", "zh-Hant"] as const) {
    const env = maxEnvelope(mode, language);
    const m = measureDiceTokenLimit(env, CUSTOMER_COPY_OUTPUT_CAP);
    console.log(`copy-envelope ${mode}/${language}: tokens=${m.token_count} cap=${CUSTOMER_COPY_OUTPUT_CAP} within=${m.within_limit}`);
    ok(m.within_limit, `max ${mode}/${language} customer-copy envelope fits ${CUSTOMER_COPY_OUTPUT_CAP} tokens`);
  }
}

console.log("dice-v0-5 customer-copy fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
