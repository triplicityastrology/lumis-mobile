/** Stage-3 customer-language editor — unit fixtures (node-runnable; MOCK adapter, no network).
 * Verifies the customer-copy schema (one closed object with a status enum), Stage-2→Stage-3
 * mapping, strict parse with the status-conditional contract, prohibited-language, complete-ending
 * heuristic, structural preservation, source parity, the shared display-validation path, execution
 * (stage3 / validated fallback / controlled unavailable), the single end-to-end deadline, and the
 * production-tokenizer max-sample envelope measurement. The customer question is sent inside the
 * Stage-3 provider input; it is not logged, persisted, or emitted in evidence here. */
import {
  DICE_V05_CUSTOMER_COPY_SCHEMA, CUSTOMER_COPY_UNAVAILABLE_MESSAGE, buildCustomerCopySchema, buildCustomerCopyInput, parseCustomerCopy,
  prohibitedLanguageCheck, completenessCheck, preservationCheck, sourceParityCheck, deterministicCustomerCopy,
  validateDisplayCopy, buildValidatedFallback, canonicalProseComplete, executeDiceV05CustomerCopy, customerCopySchemaName, COPY_CAPS, CUSTOMER_COPY_OUTPUT_CAP,
  DICE_V05_CUSTOMER_COPY_BLOCK, meaningContradictionCheck,
  type DiceV05CustomerCopy,
} from "./dice-v0-5-customer-copy.ts";
import { validateDiceV05FinalResult, type DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";
import type { DiceV05ProviderAdapter, DiceV05ProviderResult } from "./dice-v0-5-window.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }
// Build a status-"ok" copy object (adds status + schema so tests stay terse).
const copyOk = (o: Partial<DiceV05CustomerCopy> & Pick<DiceV05CustomerCopy, "language" | "question_mode" | "headline" | "reading">): DiceV05CustomerCopy =>
  Object.freeze({ schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", watch_out: null, practical_step: null, suggested_followups: [], ...o });
// Mirror of the module's ensureTerminal (adds a full stop when a field has no terminal punctuation).
const ensureTerminalLike = (s: string): string => {
  const t = String(s).trim();
  return /[.!?。！？…]["'”』」）)\]]?\s*$/u.test(t) ? t : t + ".";
};

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
/* ---- schema shape: one closed object, required status enum, nullable prose (C02) ---- */
const jSchema: any = buildCustomerCopySchema("judgment", "zh-Hant");
eq(jSchema.additionalProperties, false, "copy schema closed");
ok(jSchema.required.includes("status"), "schema requires status");
eq(jSchema.properties.status, { enum: ["ok", "unpresentable"] }, "status is an ok|unpresentable enum");
ok(Array.isArray(jSchema.properties.headline.anyOf), "headline is nullable in the provider schema (unpresentable representable)");
ok(jSchema.properties.practical_step.anyOf?.some((s: any) => s.type === "null"), "practical_step nullable in the provider schema");
eq(jSchema.properties.suggested_followups.maxItems, 3, "followups capped at 3 in the schema (count band narrowed by the parser)");
eq(customerCopySchemaName("thing_or_situation"), "lumis_dice_customer_copy_level1_v1", "level1 family schema name");

/* ---- input mapping keeps only text; both judgment axes carried ---- */
const jInput = buildCustomerCopyInput(judgmentCanonical as any, "我個application會唔會批？");
eq(jInput.locked_conclusion.required_meanings.length, 2, "judgment maps both axes as required meanings");
ok(jInput.locked_conclusion.forbidden_additions.some((f) => /averaged|blended/.test(f)), "judgment forbids blended grade");
ok(!JSON.stringify(jInput).includes("dignity_emphasis") && !JSON.stringify(jInput).includes('"rank"'), "input carries no rank/dignity_emphasis keys as facts");
const lInput = buildCustomerCopyInput(locationCanonical as any, "where is it?");
eq(lInput.source_sections.location_places, ["the bedroom", "the kitchen"], "location input carries ordered candidate places");

/* ---- C02: exact keys + identity validated BEFORE the status branch ---- */
const legalUnpresentable = (language: "en" | "zh-Hant", mode: DiceV05Mode) => JSON.stringify({
  status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language, question_mode: mode,
  headline: null, reading: null, watch_out: null, practical_step: null, suggested_followups: [],
});
eq(parseCustomerCopy("person", "en", legalUnpresentable("en", "person")).kind, "unpresentable", "C02: legal unpresentable object accepted");
// A bare {status:"unpresentable"} can no longer bypass key/identity validation.
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable" })).kind, "invalid", "C02: bare unpresentable (missing keys) rejected, not accepted");
// unpresentable with non-null prose / non-empty followups is rejected.
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: "x.", reading: null, watch_out: null, practical_step: null, suggested_followups: [] })).kind, "invalid", "C02: unpresentable with non-null prose rejected");
eq(parseCustomerCopy("person", "en", JSON.stringify({ status: "unpresentable", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "person", headline: null, reading: null, watch_out: null, practical_step: null, suggested_followups: ["q?"] })).kind, "invalid", "C02: unpresentable with nonempty followups rejected");
// wrong language/mode/schema and extra keys are all invalid regardless of status.
eq(parseCustomerCopy("person", "en", legalUnpresentable("zh-Hant", "person")).kind, "invalid", "C02: wrong language rejected even for unpresentable");
eq(parseCustomerCopy("person", "en", legalUnpresentable("en", "judgment")).kind, "invalid", "C02: wrong mode rejected even for unpresentable");

/* ---- prohibited-language + complete-ending heuristic catch the Founder-reported leaks ---- */
const badRank = copyOk({ language: "zh-Hant", question_mode: "judgment", headline: "大吉，排名第一。", reading: "第三順位又唔係好清楚。", watch_out: "留意。", suggested_followups: ["問題？"] });
ok(prohibitedLanguageCheck(badRank) !== "OK", "prohibited: rank/排名/順位/大吉 rejected");
const badFormula = copyOk({ language: "en", question_mode: "timing", headline: "It is medium.", reading: "This is planet_speed x house_speed = fastest x fast -> fast overall." });
ok(prohibitedLanguageCheck(badFormula) !== "OK", "prohibited: speed formula rejected");
const fragment = copyOk({ language: "en", question_mode: "person", headline: "This person is steady.", reading: "They tend to be careful and" });
ok(completenessCheck(fragment) !== "OK", "completeness: dangling 'and' rejected");
// C01: the known fragment is rejected WITH or WITHOUT a trailing period (normalizing punctuation must not bypass it).
ok(completenessCheck({ ...fragment, reading: "Beware of overex" }) !== "OK", "completeness: 'Beware of overex' rejected");
ok(completenessCheck({ ...fragment, reading: "Beware of overex." }) !== "OK", "C01: 'Beware of overex.' (period added) still rejected");
const cleanPerson = copyOk({ language: "en", question_mode: "person", headline: "This person is steady and practical.", reading: "They build trust slowly and prefer clear, concrete information.", practical_step: "Give them time to settle in." });
eq(prohibitedLanguageCheck(cleanPerson), "OK", "clean copy passes prohibited check");
eq(completenessCheck(cleanPerson), "OK", "clean copy passes completeness");

/* ---- C06: source parity (caution/practical presence, follow-up count) ---- */
// judgment: dropping the supplied caution is rejected; inventing follow-ups changes the count.
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), watch_out: null }, judgmentCanonical as any) === "DICE_COPY_CAUTION_DROPPED", "C06: dropped caution rejected");
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), suggested_followups: ["a?", "b?"] }, judgmentCanonical as any) === "DICE_COPY_FOLLOWUPS_COUNT_DRIFT", "C06: follow-up count drift rejected");
// S02: an equal-count REPLACEMENT/REORDER of follow-ups is rejected (not just a count change).
ok(sourceParityCheck({ ...deterministicCustomerCopy(judgmentCanonical as any), suggested_followups: ["完全不同的問題？"] }, judgmentCanonical as any) === "DICE_COPY_FOLLOWUPS_ORDER_OR_TEXT", "S02: equal-count follow-up replacement rejected");
// F07/S02: a TWO-follow-up REORDER (same items, swapped order) is rejected — a single-item case cannot
// demonstrate reordering, so this uses a two-item canonical and only permutes the order.
const twoFollowupJudgment = Object.freeze({ ...(judgmentCanonical as any), suggested_followups: ["我可以點樣改善溝通？", "我應該幾時提出？"] });
const twoFollowupBase = deterministicCustomerCopy(twoFollowupJudgment as any);
eq(sourceParityCheck(twoFollowupBase, twoFollowupJudgment as any), "OK", "F07 control: the in-order two-follow-up copy passes parity");
ok(sourceParityCheck({ ...twoFollowupBase, suggested_followups: [twoFollowupBase.suggested_followups[1], twoFollowupBase.suggested_followups[0]] }, twoFollowupJudgment as any) === "DICE_COPY_FOLLOWUPS_ORDER_OR_TEXT", "F07/S02: a two-follow-up REORDER (same items, swapped) is rejected");
// timing: inventing a caution the source did not supply is rejected.
ok(sourceParityCheck({ ...deterministicCustomerCopy(timingCanonical as any), watch_out: "Invented." }, timingCanonical as any) === "DICE_COPY_CAUTION_INVENTED", "C06: invented caution rejected");
// person (level-1): dropping the supplied practical step is rejected.
ok(sourceParityCheck({ ...deterministicCustomerCopy(personCanonical as any), practical_step: null }, personCanonical as any) === "DICE_COPY_PRACTICAL_DROPPED", "C06: dropped level-1 practical step rejected");

/* ---- deterministic fallback passes the SHARED display validation for every mode ---- */
for (const [n, c] of [["judgment", judgmentCanonical], ["timing", timingCanonical], ["location", locationCanonical], ["person", personCanonical]] as const) {
  const fb = deterministicCustomerCopy(c as any);
  eq(validateDisplayCopy(fb, c as any), "OK", `fallback ${n} passes the shared display validation`);
  eq(sourceParityCheck(fb, c as any), "OK", `fallback ${n} preserves caution/practical/follow-up parity`);
}
// C06: the judgment fallback keeps BOTH factors (planet + house prose) and stays within the reading cap.
const jFb = deterministicCustomerCopy(judgmentCanonical as any);
ok(jFb.reading.includes("火星") && jFb.reading.includes("外在條件"), "judgment fallback keeps both distinct factors");

/* ---- C01: a Judgment fallback whose combined reading exceeds the cap becomes unavailable, never sliced ---- */
const oversizeJudgment = { ...judgmentCanonical, planet_side: { ...(judgmentCanonical as any).planet_side, prose: "火".repeat(200) + "。" }, house_side: { ...(judgmentCanonical as any).house_side, prose: "外".repeat(200) + "。" } };
const oversizeFb = buildValidatedFallback(oversizeJudgment as any);
ok(!oversizeFb.ok, "C01: an over-cap judgment fallback is rejected (not sliced to fit)");

/* ---- execution (ALL-MODE editor path, 2026-09-17): the provider's edited answer + explanation are
 *      DISPLAYED for every mode; controlled fields (watch/step/follow-ups) stay canonical. ---- */
const copyAdapter = (content: string, kind: DiceV05ProviderResult["kind"] = "success"): DiceV05ProviderAdapter => ({
  invoke: async () => (kind === "success" ? { kind: "success", content } : { kind } as DiceV05ProviderResult),
});
// A valid judgment provider copy: its edited headline + reading ARE now displayed (source stage3);
// the caution and follow-ups still come from the canonical result.
const goodJudgmentCopy = JSON.stringify(copyOk({
  language: "zh-Hant", question_mode: "judgment",
  headline: "外在條件較有利，但你的處理方式是關鍵。", reading: "對方有合作空間，環境對你有利。不過你這面處理得太急或太強硬，容易帶來磨擦，兩者要分開理解。",
  watch_out: "跟進時保持主動，但不要催逼對方。", suggested_followups: ["我可以點樣改善溝通？"],
}));
const r1 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "我個application會唔會批？", copyAdapter(goodJudgmentCopy), { now: () => 1000 });
eq(r1.source, "stage3", "valid judgment provider copy → edited prose IS displayed (all-mode editor)");
eq(r1.provider_calls, 1, "one Stage-3 provider call");
ok(r1.copy && r1.copy.practical_step === null, "judgment copy keeps practical_step null");
ok(r1.copy && r1.copy.reading.includes("對方有合作空間"), "judgment display uses the PROVIDER reading");
ok(r1.copy && r1.copy.watch_out === ensureTerminalLike((judgmentCanonical as any).watch_out), "judgment watch_out stays canonical, not the provider's");
ok(r1.copy && JSON.stringify(r1.copy.suggested_followups) === JSON.stringify(((judgmentCanonical as any).suggested_followups as string[]).map(ensureTerminalLike)), "judgment follow-ups stay canonical");
// A valid Level-1 provider copy: its explanatory prose IS used (source stage3); controlled fields
// (watch/practical/follow-ups) still come from the canonical result.
const goodPersonCopy = JSON.stringify(copyOk({
  language: "en", question_mode: "person",
  headline: "They are steady and reliable.", reading: "They earn trust slowly through consistent, dependable actions.",
  watch_out: "Ignore me.", practical_step: "Ignore me too.",
}));
const rL = await executeDiceV05CustomerCopy(personCanonical as any, "what kind of person?", copyAdapter(goodPersonCopy), { now: () => 1000 });
eq(rL.source, "stage3", "valid Level-1 provider prose is used");
ok(rL.copy && rL.copy.reading.includes("consistent"), "Level-1 display uses provider reading");
ok(rL.copy && rL.copy.watch_out === ensureTerminalLike((personCanonical as any).watch_out), "Level-1 watch_out stays canonical, not the provider's");
ok(rL.copy && rL.copy.practical_step === ensureTerminalLike((personCanonical as any).practical_step), "Level-1 practical_step stays canonical, not the provider's");

/* ---- execution: a judgment provider copy whose EDITED prose leaks rank/大吉 → rejected → fallback ---- */
const rankyCopy = JSON.stringify(copyOk({ language: "zh-Hant", question_mode: "judgment", headline: "排名第一，大吉。", reading: "第三順位。", watch_out: "留意。", suggested_followups: ["我可以點樣改善溝通？"] }));
const r2 = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", copyAdapter(rankyCopy), { now: () => 1000 });
eq(r2.source, "fallback", "a judgment provider copy leaking rank/大吉 is rejected → deterministic fallback");
ok(r2.copy && prohibitedLanguageCheck(r2.copy) === "OK", "the displayed judgment fallback is clean (canonical, not the prohibited provider prose)");

/* ---- execution: a Level-1 provider copy whose PROSE is prohibited → fallback ---- */
const rankyPersonCopy = JSON.stringify(copyOk({ language: "en", question_mode: "person", headline: "They rank first.", reading: "This sits on rank 7 of the houses." }));
const rLbad = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(rankyPersonCopy), { now: () => 1000 });
eq(rLbad.source, "fallback", "Level-1 provider copy with prohibited prose falls back deterministically");
ok(rLbad.copy && prohibitedLanguageCheck(rLbad.copy) === "OK", "the Level-1 fallback is clean");

/* ---- execution: provider network error → fallback; legal unpresentable → fallback/unavailable ---- */
const r3 = await executeDiceV05CustomerCopy(timingCanonical as any, "幾時批？", copyAdapter("", "network"), { now: () => 1000 });
eq(r3.source, "fallback", "provider failure falls back");
const r4 = await executeDiceV05CustomerCopy(personCanonical as any, "what kind of person?", copyAdapter(legalUnpresentable("en", "person")), { now: () => 1000 });
ok(r4.source === "fallback" || r4.source === "unavailable", "explicit unpresentable routes to fallback/unavailable, never a reading");
eq(r4.failure_code?.startsWith("DICE_COPY_UNPRESENTABLE"), true, "unpresentable code recorded");

/* ---- C03: one absolute deadline — exhausted budget makes ZERO Stage-3 calls ---- */
let called = 0;
const countingAdapter: DiceV05ProviderAdapter = { invoke: async () => { called += 1; return { kind: "success", content: goodJudgmentCopy }; } };
const past = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", countingAdapter, { now: () => 5000, deadlineAtMs: 4000 });
eq(called, 0, "C03: no time left → zero Stage-3 provider calls");
ok(past.source === "fallback" || past.source === "unavailable", "C03: exhausted budget yields fallback/unavailable");
eq(past.provider_calls, 0, "C03: provider_calls is 0 when the budget is already spent");
// A retry runs against the SAME absolute deadline (it does not reset it): a failing adapter that
// keeps time within budget is allowed exactly two attempts, no more.
let attempts = 0;
const twoThenStop: DiceV05ProviderAdapter = { invoke: async () => { attempts += 1; return { kind: "network" } as DiceV05ProviderResult; } };
let clock = 1000;
const retry = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", twoThenStop, { now: () => clock, deadlineAtMs: 12000 });
eq(attempts, 2, "C03: one controlled retry → exactly two attempts within the shared deadline");
eq(retry.provider_calls, 2, "C03: two provider calls recorded for the retry path");

/* ---- G04-B: Stage-3 counts only real TRANSPORT requests, on the first attempt AND the retry. ---- */
// Both attempts short-circuit before any network call (transported:false) → zero provider calls.
let g04Attempts = 0;
const noTransport: DiceV05ProviderAdapter = { invoke: async () => { g04Attempts += 1; return { kind: "timeout", transported: false } as DiceV05ProviderResult; } };
const g04NoTransport = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", noTransport, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04Attempts, 2, "G04-B: both Stage-3 attempts were made (budget available)");
eq(g04NoTransport.provider_calls, 0, "G04-B: a non-transported attempt is NOT counted, on either attempt");
// One real transport (network failure) then a non-transported retry → exactly one provider call.
let g04Seq = 0;
const oneThenNone: DiceV05ProviderAdapter = { invoke: async () => { g04Seq += 1; return (g04Seq === 1 ? { kind: "network" } : { kind: "timeout", transported: false }) as DiceV05ProviderResult; } };
const g04Mixed = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", oneThenNone, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04Mixed.provider_calls, 1, "G04-B: one real transport + one non-transported retry → exactly one provider call");
// A genuine transported failure on both attempts IS counted twice (contrast control).
let g04Real = 0;
const realFail: DiceV05ProviderAdapter = { invoke: async () => { g04Real += 1; return { kind: "network" } as DiceV05ProviderResult; } };
const g04RealRes = await executeDiceV05CustomerCopy(judgmentCanonical as any, "q", realFail, { now: () => 1000, deadlineAtMs: 20000 });
eq(g04RealRes.provider_calls, 2, "G04-B: two genuine transported failures are counted as two provider calls");

/* ---- D02: the RAW provider output is measured before parse/normalization (real tokenizer) ---- */
// A valid person copy padded with whitespace so the RAW string exceeds the 700-token cap while the
// NORMALIZED object stays well within it. The raw guard must reject it (→ fallback), proving that
// whitespace/escape padding cannot slip a huge raw response past measurement.
const paddedRaw = JSON.stringify(copyOk({ language: "en", question_mode: "person", headline: "They are steady.", reading: "They build trust slowly." })) + " \n".repeat(1500);
ok(!measureDiceTokenLimit(paddedRaw, CUSTOMER_COPY_OUTPUT_CAP).within_limit, "D02: the padded RAW string exceeds the 700-token cap");
const rawRes = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(paddedRaw), { now: () => 1000 });
eq(rawRes.source, "fallback", "D02: an over-cap RAW response is rejected before parse → deterministic fallback");
ok(rawRes.failure_code === "DICE_COPY_RAW_OUTPUT_TOKEN_CAP", "D02: raw-output cap failure code recorded");

/* ---- S06: a dangling fragment (with a trailing period) from the provider is rejected, not laundered ---- */
const fragRes = await executeDiceV05CustomerCopy(personCanonical as any, "q", copyAdapter(JSON.stringify(copyOk({ language: "en", question_mode: "person", headline: "They are steady.", reading: "They tend to be careful and." }))), { now: () => 1000 });
eq(fragRes.source, "fallback", "S06: 'They tend to be careful and.' provider copy is rejected → fallback");
ok(fragRes.copy && completenessCheck(fragRes.copy) === "OK", "S06: the resulting fallback is itself complete");

/* ---- F03: each Judgment source-prose COMPONENT is validated before the components are joined.
 *      A broken Planet, House or synthesis component makes the deterministic assembly UNAVAILABLE
 *      (a valid final synthesis never conceals an earlier fragment), with and without a terminal
 *      period, in EN and zh-Hant. ---- */
const enJudgment = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護（最強）", strength: "strong",
    constructive_traits: "Generous, trustworthy and wise", difficult_traits: "Wasteful, reckless and careless", dignity_emphasis: "constructive",
    prose: "Jupiter is a major benefic at full strength here." },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "House 1 is the most supportive setting, with the matter in your hands." },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "Both fixed sides are favourable and remain separate.", timing_summary: null,
  watch_out: "Keep optimism realistic even with strong support.", practical_step: null, suggested_followups: ["What most needs preparing first?"] };
eq(validateDiceV05FinalResult(enJudgment as any), "OK", "F03 control: the EN Judgment canonical is a valid final result");
eq(canonicalProseComplete(enJudgment as any), "OK", "F03 control: a fully complete Judgment canonical passes component validation");
for (const [label, broken] of [
  ["P12 planet prose 'and' (period)", { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and." } }],
  ["P12 planet prose 'and' (no period)", { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and" } }],
  ["P13 house prose 'overex' (period)", { ...enJudgment, house_side: { ...enJudgment.house_side, prose: "Beware of overex." } }],
  ["P13 house prose 'overex' (no period)", { ...enJudgment, house_side: { ...enJudgment.house_side, prose: "Beware of overex" } }],
  ["synthesis 'because'", { ...enJudgment, synthesis: "A strong benefic sits inside the house because" }],
  ["zh planet prose connector '因為'", { ...judgmentCanonical, planet_side: { ...(judgmentCanonical as any).planet_side, prose: "火星這一面較為困難，因為" } }],
  ["zh synthesis connector '所以'", { ...judgmentCanonical, synthesis: "外在環境有利，所以" }],
] as const) {
  ok(canonicalProseComplete(broken as any) !== "OK", `F03: broken component caught before join — ${label}`);
  ok(!buildValidatedFallback(broken as any).ok, `F03: buildValidatedFallback → unavailable for ${label}`);
}
// A valid final synthesis must NOT conceal an earlier broken Planet prose (the exact S06 regression).
const hiddenFragment = { ...enJudgment, planet_side: { ...enJudgment.planet_side, prose: "They tend to be careful and" } };
ok(!buildValidatedFallback(hiddenFragment as any).ok, "F03: a valid synthesis does not conceal an earlier Planet-prose fragment");

/* ---- F04: the Chinese dangling-tail heuristic no longer rejects ordinary sentences that merely END
 *      in a character that can also be a connector (同/和). Positive controls MUST pass; genuine
 *      unfinished multi-character connector clauses MUST still fail. ---- */
for (const good of ["每個人的需要不同。", "溝通時保持溫和。", "這個決定需要耐心。", "佢哋通常都好謹慎同務實。"]) {
  eq(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個穩陣務實嘅人。", reading: good })), "OK", `F04 positive control passes: ${good}`);
}
// English: a sentence legitimately ending after a complete clause is not a fragment.
eq(completenessCheck(copyOk({ language: "en", question_mode: "person", headline: "A steady person.", reading: "That is what the symbols point to." })), "OK", "F04: ordinary English sentence passes");
// Genuine unfinished connector clauses still fail (EN 'because'; zh multi-char connectors).
ok(completenessCheck(copyOk({ language: "en", question_mode: "person", headline: "A steady person.", reading: "They are careful because" })) !== "OK", "F04: genuine EN connector clause still rejected");
ok(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個人。", reading: "佢哋好謹慎，因為" })) !== "OK", "F04: genuine zh '因為' connector clause still rejected");
ok(completenessCheck(copyOk({ language: "zh-Hant", question_mode: "person", headline: "一個人。", reading: "佢哋好謹慎，不過" })) !== "OK", "F04: genuine zh '不過' connector clause still rejected");

/* ---- production-tokenizer max-sample envelope measurement (report + assert within cap) ---- */
const maxEnvelope = (mode: DiceV05Mode, language: "en" | "zh-Hant") => {
  const c = COPY_CAPS; const fam = mode === "judgment" || mode === "timing" || mode === "location" ? mode : "level1";
  const fill = (n: number) => (language === "en" ? "a" : "字").repeat(n);
  const body: any = { status: "ok", schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language, question_mode: mode,
    headline: fill(c.headline[language]), reading: fill(c.reading[language]),
    watch_out: fill(c.watch_out[language]),
    practical_step: fam === "judgment" || fam === "timing" ? null : fill(c.practical_step[language]),
    suggested_followups: fam === "judgment" ? [fill(c.followup[language]), fill(c.followup[language]), fill(c.followup[language])] : [] };
  return JSON.stringify(body);
};
for (const mode of ["judgment", "timing", "location", "person"] as DiceV05Mode[]) {
  for (const language of ["en", "zh-Hant"] as const) {
    const env = maxEnvelope(mode, language);
    const m = measureDiceTokenLimit(env, CUSTOMER_COPY_OUTPUT_CAP);
    console.log(`copy-envelope ${mode}/${language}: tokens=${m.token_count} cap=${CUSTOMER_COPY_OUTPUT_CAP} within=${m.within_limit} (max among filled samples, not a mathematical worst case)`);
    ok(m.within_limit, `max-sample ${mode}/${language} customer-copy envelope fits ${CUSTOMER_COPY_OUTPUT_CAP} tokens`);
  }
}

// The fixed unavailable message is stable and non-interpretive.
ok(CUSTOMER_COPY_UNAVAILABLE_MESSAGE.en.length > 0 && CUSTOMER_COPY_UNAVAILABLE_MESSAGE["zh-Hant"].length > 0, "unavailable message defined for both languages");

/* ---- L-round: the all-mode meaning-contradiction guard (targeted, documented heuristics). ---- */
// Judgment: on a MIXED canonical a totalizing one-sided claim is rejected either way; a faithful
// mixed rewrite passes. planet_side.dignity_emphasis "constructive" (favourable) + house misfortune (difficult).
const mixedJudg = { ...(enJudgment as any), house_side: { fortune: "great_misfortune", fortune_zh: "大凶", rank: 12, prose: "House 12 is a hidden, difficult setting here." }, synthesis: "The planet side is favourable while the house environment is difficult." };
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Everything is favourable.", reading: "Both factors support you with no obstacles at all.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any) !== "OK", "L: an all-positive reading on a mixed canonical is rejected (dropped-difficult)");
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Both factors oppose this.", reading: "Everything here is against you and unfavourable.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any) !== "OK", "L: an all-negative reading on a mixed canonical is rejected (dropped-favourable)");
eq(meaningContradictionCheck(copyOk({ language: "en", question_mode: "judgment", headline: "Your strengths are real, but the setting is hard.", reading: "You have genuine capacity working for you, yet the surroundings make it difficult; the two stay separate.", watch_out: "Stay grounded.", suggested_followups: ["Q?"] }), mixedJudg as any), "OK", "L: a faithful mixed rewrite passes the contradiction guard");
// Timing: canonical medium; a positive immediacy claim is rejected, a negated one passes.
ok(meaningContradictionCheck(copyOk({ language: "en", question_mode: "timing", headline: "It resolves immediately.", reading: "This happens right away." }), timingCanonical as any) !== "OK", "L: an immediacy claim contradicting a medium canonical is rejected");
eq(meaningContradictionCheck(copyOk({ language: "en", question_mode: "timing", headline: "A moderate wait is likely.", reading: "This will not resolve immediately; it develops over time." }), timingCanonical as any), "OK", "L: a negated-immediacy moderate rewrite passes");

/* ---- L-round: full Stage-3 INPUT + assembled-envelope token measurement with the runtime tokenizer
 *      (report; the input rides the provider GENERATION allowance, the envelope rides the 700 cap). ---- */
for (const [mode, canonical, q] of [["judgment", judgmentCanonical, "我個application會唔會批？"], ["timing", timingCanonical, "幾時會有結果？"], ["location", locationCanonical, "喺邊度？"], ["person", personCanonical, "係咩人？"]] as const) {
  const providerInput = `${DICE_V05_CUSTOMER_COPY_BLOCK}\nINPUT_JSON:\n${JSON.stringify(buildCustomerCopyInput(canonical as any, q))}`;
  const inTok = measureDiceTokenLimit(providerInput, 100000).token_count;
  const fb = buildValidatedFallback(canonical as any);
  const envTok = fb.ok ? measureDiceTokenLimit(JSON.stringify(fb.copy), CUSTOMER_COPY_OUTPUT_CAP) : { token_count: -1, within_limit: false };
  ok(fb.ok, `L: ${mode} deterministic envelope builds`);
  ok(envTok.within_limit, `L: ${mode} assembled display envelope within the 700-token cap (tokens=${envTok.token_count})`);
  console.log(`stage3-io ${mode}: input_tokens=${inTok} (runtime tokenizer, real INPUT_JSON), display_envelope_tokens=${envTok.token_count} cap=${CUSTOMER_COPY_OUTPUT_CAP} (not a mathematical worst case; representative fixture)`);
}

console.log("dice-v0-5 customer-copy fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
